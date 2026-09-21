"""
INTEGRATION APP — Models

This app exposes a small, read-only slice of Patrick's asset and
depreciation data to OTHER systems — most importantly Stephen's
Lease & Budget Management System (the second half of the dissertation
project).

External systems do NOT log in as Django users. Instead, an admin
creates an IntegrationClient for each external system, copies the
generated api_key, and gives it to that system. From then on, the
external system calls `/api/integration/...` with the header
`X-API-Key: <key>` and our custom authentication class accepts it.

Two models live here:
  - IntegrationClient: one row per external system (Stephen's lease
    system, a reporting tool, a mobile app, etc.). Stores the api_key,
    a human-readable name, an active/inactive flag, and a timestamp of
    the last successful call.
  - IntegrationLog: an audit row for every call made against the
    integration endpoints — so we can prove who accessed what and when.
"""

import uuid
import secrets
from django.db import models


# Helper used as the default value for the api_key field.
# `secrets.token_urlsafe(48)` returns a URL-safe random string with
# ~64 characters of entropy — strong enough that guessing it is
# infeasible. We define it as a module-level function (not a lambda)
# so that Django migrations can serialize it.
def _generate_api_key():
    """Return a fresh, cryptographically-strong API key for a client."""
    return secrets.token_urlsafe(48)


# INTEGRATION CLIENT MODEL — one row per external system
class IntegrationClient(models.Model):
    """
    Represents an external system authorized to call Patrick's
    integration endpoints.

    Stephen's Lease & Budget system will be one row here. In future,
    other consumers (a mobile app, a BI tool, a partner agency) would
    each get their own row so we can revoke access individually.
    """

    # UUID primary key for security (so client IDs are unguessable)
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Human-readable name of the consuming system
    # e.g. "Stephen's Lease & Budget System"
    name = models.CharField(max_length=150, unique=True)

    # Optional short description of what this client is used for
    description = models.TextField(blank=True)

    # The actual secret token. Sent in the X-API-Key header on every
    # request. Generated automatically and stored in cleartext — for
    # a dissertation system this is fine; a production system would
    # hash it like a password.
    api_key = models.CharField(
        max_length=128,
        unique=True,
        default=_generate_api_key,
        help_text='Generated automatically. Copy once and give it to the consuming system.'
    )

    # Optional contact email for the team operating this client
    contact_email = models.EmailField(blank=True)

    # Whether this client is currently allowed to call the API.
    # Setting this to False is the "soft revoke" — the row stays in
    # the database (so logs still link to it) but no new calls succeed.
    is_active = models.BooleanField(default=True)

    # Updated by the authentication class every time a request from
    # this client succeeds. Useful for spotting stale or unused keys.
    last_used_at = models.DateTimeField(null=True, blank=True)

    # Audit timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Integration Client'
        verbose_name_plural = 'Integration Clients'

    def __str__(self):
        # Show the client's name and whether it's currently active
        suffix = '' if self.is_active else ' (revoked)'
        return f"{self.name}{suffix}"

    # Helper Methods
    def rotate_api_key(self):
        """
        Generate a brand-new api_key for this client.

        Use this if the existing key may have leaked. The consuming
        system will need the new key — old key stops working immediately.
        """
        self.api_key = _generate_api_key()
        self.save(update_fields=['api_key', 'updated_at'])
        return self.api_key

    @property
    def is_authenticated(self):
        """
        DRF's permission classes expect `request.user.is_authenticated`.
        When an IntegrationClient is used as the "user" of a request,
        we want it to count as authenticated.
        """
        return True


# INTEGRATION LOG MODEL — one row per call from an external system
class IntegrationLog(models.Model):
    """
    Audit trail for every request the integration endpoints handle.

    Created automatically by IntegrationKeyAuthentication on success
    (and by a small piece of view-level wiring on failure). Lets the
    admin see exactly what each client has been doing.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Which client made the call. Nullable because a request with an
    # invalid key still gets logged (so we can spot probing/abuse) and
    # there's no client to point at in that case.
    client = models.ForeignKey(
        IntegrationClient,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='logs',
    )

    # The HTTP method (GET, POST, etc.) used by the caller
    method = models.CharField(max_length=10)

    # The path that was hit (e.g. "/api/integration/assets/")
    endpoint = models.CharField(max_length=255)

    # The HTTP status we returned (200, 401, 403, 404, etc.)
    status_code = models.PositiveSmallIntegerField()

    # IP the caller appeared to come from. Best-effort only — proxies
    # can spoof this, so don't treat it as ground truth.
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    # Optional message — e.g. "invalid api key" for failed calls
    message = models.CharField(max_length=255, blank=True)

    # When the call happened
    called_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-called_at']
        verbose_name = 'Integration Log'
        verbose_name_plural = 'Integration Logs'
        # Speeds up "show me the recent calls from this client" queries
        indexes = [
            models.Index(fields=['-called_at']),
            models.Index(fields=['client', '-called_at']),
        ]

    def __str__(self):
        who = self.client.name if self.client else 'unknown'
        return f"{who} {self.method} {self.endpoint} -> {self.status_code}"
