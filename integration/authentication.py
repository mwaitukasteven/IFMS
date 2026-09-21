"""
INTEGRATION APP — Custom Authentication

Django REST Framework lets us plug in our own authentication classes.
For Patrick's integration endpoints we don't want the caller to be a
Django User logging in with a username/password or a JWT — we want
the caller to be an external SYSTEM (Stephen's lease/budget app)
identifying itself with a long-lived API key.

How it works:
  1. The external system sends every request with a header:
        X-API-Key: <the key the admin gave them>
  2. DRF runs IntegrationKeyAuthentication.authenticate() on every
     request to a view that declares this class.
  3. We look up an active IntegrationClient with that api_key.
     - No header / wrong key  -> AuthenticationFailed (401)
     - Client exists & active -> request.user is set to that client,
       last_used_at is bumped, and the request proceeds.
  4. The view's perform_create / serializer.save can now read
     `request.user` to find out which client called us. Because
     IntegrationClient has an is_authenticated=True property, DRF's
     IsAuthenticated permission also accepts it.
"""

from django.utils import timezone
from rest_framework import authentication, exceptions

from .models import IntegrationClient, IntegrationLog


# Name of the HTTP header the consuming system must send.
# Django translates `X-API-Key` into `HTTP_X_API_KEY` in META, which
# is what we look up below.
API_KEY_HEADER = 'HTTP_X_API_KEY'


def _client_ip(request):
    """
    Pull the caller's IP out of the request. We check the standard
    X-Forwarded-For header first (so we still get the real IP when
    Django is sitting behind nginx or a load balancer) and fall back
    to REMOTE_ADDR otherwise.
    """
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        # X-Forwarded-For is a comma-separated list: "client, proxy1, proxy2".
        # The first entry is the original client.
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


class IntegrationKeyAuthentication(authentication.BaseAuthentication):
    """
    Authenticates a request using the X-API-Key header against the
    IntegrationClient table.

    On success the returned tuple becomes (request.user, request.auth)
    in the view, so `request.user` will be the IntegrationClient.
    """

    # Tells DRF what scheme to put in the WWW-Authenticate header on 401s
    def authenticate_header(self, request):
        return 'X-API-Key'

    def authenticate(self, request):
        # Look up the header — return None if it's missing so DRF can
        # try other authentication classes (we won't have any, but this
        # is the polite contract).
        api_key = request.META.get(API_KEY_HEADER)
        if not api_key:
            return None

        # Try to find an active client with this key.
        try:
            client = IntegrationClient.objects.get(api_key=api_key, is_active=True)
        except IntegrationClient.DoesNotExist:
            # Log the failed attempt so an admin can spot probing.
            # We don't have a client to link, so client stays null.
            IntegrationLog.objects.create(
                client=None,
                method=request.method,
                endpoint=request.path,
                status_code=401,
                ip_address=_client_ip(request),
                message='invalid or revoked api key',
            )
            raise exceptions.AuthenticationFailed('Invalid or revoked API key.')

        # Bump last_used_at — useful for spotting stale keys later.
        # We use update_fields so we only touch one column.
        client.last_used_at = timezone.now()
        client.save(update_fields=['last_used_at'])

        # Stash the resolved IP on the request so the view's logging
        # mixin can reuse it without reparsing the headers.
        request._integration_client_ip = _client_ip(request)

        # DRF's contract: return (user, auth). We don't have a token
        # object to expose, so auth is None.
        return (client, None)
