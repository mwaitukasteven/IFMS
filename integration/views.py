"""
INTEGRATION APP — API Views

Two groups of viewsets here:

1. EXTERNAL viewsets — what Stephen's lease/budget system actually
   calls. Read-only, authenticated by X-API-Key (NOT by JWT). Every
   call is logged so the admin has a complete audit trail.

2. INTERNAL admin viewsets — for Patrick to manage IntegrationClients
   and review IntegrationLogs from the React frontend. JWT-protected
   and admin-only.

Endpoints exposed under /api/integration/ :
  GET   /api/integration/assets/                       (external) list assets
  GET   /api/integration/assets/<id>/                  (external) one asset + history
  GET   /api/integration/assets/by_code/<asset_code>/  (external) lookup by asset code
  GET   /api/integration/assets/summary/               (external) headline totals

  GET   /api/integration/depreciation/                 (external) all schedule rows
  GET   /api/integration/depreciation/by_asset/<asset_id>/ (external) one asset's schedule

  GET/POST/etc   /api/integration/clients/             (admin) manage api keys
  POST  /api/integration/clients/<id>/rotate_key/      (admin) issue a fresh key

  GET   /api/integration/logs/                         (admin) audit trail
  GET   /api/integration/logs/stats/                   (admin) dashboard stats
"""

from decimal import Decimal
from django.db.models import Sum, Count
from django.shortcuts import get_object_or_404

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework_simplejwt.authentication import JWTAuthentication

from assets.models import Asset
from depreciation.models import DepreciationSchedule
from .authentication import IntegrationKeyAuthentication
from .models import IntegrationClient, IntegrationLog
from .serializers import (
    IntegrationAssetListSerializer,
    IntegrationAssetDetailSerializer,
    IntegrationDepreciationScheduleSerializer,
    IntegrationClientSerializer,
    IntegrationLogSerializer,
)


# AUDIT-LOGGING MIXIN — used by every external viewset

class LoggedIntegrationMixin:
    """
    Drop-in mixin for external viewsets that writes one IntegrationLog
    row after each request.

    DRF calls `finalize_response` right before sending the response back
    to the client, which is the perfect hook: we know who the caller
    was (request.user is the IntegrationClient by then) and what the
    final status code is.
    """

    def finalize_response(self, request, response, *args, **kwargs):
        # Let DRF do its normal finalization first so response.status_code is set
        response = super().finalize_response(request, response, *args, **kwargs)

        # Only log if this request actually went through our integration
        # authentication. request.user will be an IntegrationClient in
        # that case (because IntegrationKeyAuthentication returned it).
        if isinstance(getattr(request, 'user', None), IntegrationClient):
            IntegrationLog.objects.create(
                client=request.user,
                method=request.method,
                endpoint=request.path,
                status_code=response.status_code,
                ip_address=getattr(request, '_integration_client_ip', None),
                message='',
            )
        return response


# EXTERNAL VIEWSETS — called by Stephen's system using X-API-Key

class ExternalAssetViewSet(LoggedIntegrationMixin, viewsets.ReadOnlyModelViewSet):
    """
    Read-only access to assets for external systems.

    Why read-only? Stephen's system should never be able to mutate
    Patrick's asset register — it is consuming the data, not owning it.
    """

    # We pre-fetch related rows so that the serializer's nested fields
    # (valuations, schedules) don't trigger N+1 queries on detail calls.
    queryset = Asset.objects.all().prefetch_related(
        'valuations', 'depreciation_policies__schedules'
    )
    permission_classes = [IsAuthenticated]
    authentication_classes = [IntegrationKeyAuthentication]

    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['asset_code', 'name', 'location', 'category']
    ordering_fields = ['acquisition_date', 'acquisition_cost', 'name', 'created_at']
    ordering = ['-created_at']

    def get_serializer_class(self):
        """Lightweight serializer on list, full detail elsewhere."""
        if self.action == 'list':
            return IntegrationAssetListSerializer
        return IntegrationAssetDetailSerializer

    # Custom action: look up an asset by its human-readable code instead of UUID.
    # Stephen's system tracks assets by code (ASSET-2026-001), so this is
    # friendlier than asking him to remember our UUIDs.
    @action(detail=False, methods=['get'], url_path=r'by_code/(?P<asset_code>[^/.]+)')
    def by_code(self, request, asset_code=None):
        """GET /api/integration/assets/by_code/<asset_code>/ → single asset."""
        asset = get_object_or_404(Asset, asset_code=asset_code)
        serializer = IntegrationAssetDetailSerializer(asset)
        return Response(serializer.data)

    # Custom action: headline numbers for the consuming system's dashboard
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        GET /api/integration/assets/summary/

        Aggregate snapshot of the asset register — useful for a quick
        sanity check on Stephen's side before pulling full lists.
        """
        total_assets = Asset.objects.count()
        active_assets = Asset.objects.filter(status=Asset.STATUS_ACTIVE).count()
        total_acquisition = Asset.objects.aggregate(
            total=Sum('acquisition_cost')
        )['total'] or 0

        # Total book value = sum of each asset's MOST RECENT schedule row.
        # If we simply summed closing_nbv across every row we'd double-count
        # (a single asset with an 8-year schedule would contribute 8 NBV
        # snapshots). Instead, per asset, take max(period_year) -> closing_nbv,
        # then add the acquisition_cost of any asset that has no policy yet.
        total_nbv = Decimal('0.00')
        for asset in Asset.objects.all():
            latest = (
                DepreciationSchedule.objects
                .filter(policy__asset=asset)
                .order_by('-period_year')
                .first()
            )
            total_nbv += latest.closing_nbv if latest else asset.acquisition_cost

        return Response({
            'total_assets': total_assets,
            'active_assets': active_assets,
            'total_acquisition_cost': total_acquisition,
            'total_current_nbv_estimate': total_nbv,
        })


class ExternalDepreciationViewSet(LoggedIntegrationMixin, viewsets.ReadOnlyModelViewSet):
    """
    Read-only access to depreciation schedule rows.

    Stephen's system uses this to attribute depreciation expense to
    the lease/budget periods it manages.
    """

    queryset = DepreciationSchedule.objects.all().select_related(
        'policy', 'policy__asset'
    )
    serializer_class = IntegrationDepreciationScheduleSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [IntegrationKeyAuthentication]

    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['policy__asset__asset_code', 'policy__asset__name']
    ordering_fields = ['period_year', 'created_at']
    ordering = ['policy', 'period_year']

    # Custom action: full schedule for one asset (by UUID)
    @action(detail=False, methods=['get'], url_path=r'by_asset/(?P<asset_id>[0-9a-f-]+)')
    def by_asset(self, request, asset_id=None):
        """GET /api/integration/depreciation/by_asset/<asset_id>/ → schedule rows."""
        # Make sure the asset exists (404 if not), then pull its rows
        get_object_or_404(Asset, pk=asset_id)
        rows = DepreciationSchedule.objects.filter(
            policy__asset_id=asset_id
        ).order_by('period_year')
        serializer = self.get_serializer(rows, many=True)
        return Response(serializer.data)


# INTERNAL ADMIN VIEWSETS — JWT-protected, used by Patrick's React UI

class IntegrationClientViewSet(viewsets.ModelViewSet):
    """
    Full CRUD for IntegrationClient rows.

    Patrick uses this in the React dashboard to provision a new client
    for Stephen, copy the generated key once, rotate it if leaked, or
    revoke it (by toggling is_active off).
    """

    queryset = IntegrationClient.objects.all()
    serializer_class = IntegrationClientSerializer
    # Stays inside the regular JWT flow used by the rest of the backend
    authentication_classes = [JWTAuthentication]
    # Only admins should be able to mint or revoke keys
    permission_classes = [IsAuthenticated, IsAdminUser]

    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['name', 'description', 'contact_email']
    ordering_fields = ['created_at', 'last_used_at', 'name']
    ordering = ['-created_at']

    # Custom action: issue a fresh api_key for this client
    @action(detail=True, methods=['post'])
    def rotate_key(self, request, pk=None):
        """
        POST /api/integration/clients/<id>/rotate_key/

        Generates a new api_key and returns it. The old key stops
        working immediately, so the consuming system must be updated.
        """
        client = self.get_object()
        new_key = client.rotate_api_key()
        return Response({
            'message': 'API key rotated. Update the consuming system immediately.',
            'api_key': new_key,
        }, status=status.HTTP_200_OK)


class IntegrationLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only audit log viewer.

    Logs are written by the auth class and the LoggedIntegrationMixin
    — never by humans — so we expose only list/retrieve.
    """

    queryset = IntegrationLog.objects.all().select_related('client')
    serializer_class = IntegrationLogSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminUser]

    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['endpoint', 'method', 'message', 'client__name']
    ordering_fields = ['called_at', 'status_code']
    ordering = ['-called_at']

    # Custom action: dashboard headline stats
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        GET /api/integration/logs/stats/

        Headline activity numbers across all clients — total calls,
        success vs error breakdown, top-N busiest clients.
        """
        total_calls = IntegrationLog.objects.count()
        success_calls = IntegrationLog.objects.filter(
            status_code__lt=400
        ).count()
        failed_calls = total_calls - success_calls

        # Top 5 busiest clients (by call count)
        top_clients = list(
            IntegrationLog.objects
            .exclude(client__isnull=True)
            .values('client__name')
            .annotate(call_count=Count('id'))
            .order_by('-call_count')[:5]
        )

        return Response({
            'total_calls': total_calls,
            'successful_calls': success_calls,
            'failed_calls': failed_calls,
            'top_clients': top_clients,
        })
