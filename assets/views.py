"""
ASSETS APP — API Views

ViewSets handle all CRUD operations for assets, valuations, and events.

Endpoints:
  GET    /api/assets/                       → List all assets
  POST   /api/assets/                       → Create a new asset
  GET    /api/assets/<id>/                  → Get one asset (with valuations & events)
  PUT    /api/assets/<id>/                  → Update an asset
  DELETE /api/assets/<id>/                  → Delete an asset
  GET    /api/assets/<id>/valuations/       → All valuations for one asset
  GET    /api/assets/<id>/events/           → All events for one asset

  GET    /api/assets/valuations/            → List all valuations
  POST   /api/assets/valuations/            → Create a valuation
  GET    /api/assets/valuations/<id>/       → Get one valuation
  ...etc

  GET    /api/assets/events/                → List all events
  POST   /api/assets/events/                → Create an event
  ...etc
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Asset, AssetValuation, AssetEvent
from .serializers import (
    AssetListSerializer, AssetDetailSerializer,
    AssetValuationSerializer, AssetEventSerializer,
)


# ASSET VIEWSET — full CRUD + nested resources
class AssetViewSet(viewsets.ModelViewSet):
    """
    Provides standard CRUD endpoints for assets + custom actions
    for nested resources (valuations and events).
    """

    queryset = Asset.objects.all().select_related('created_by')
    permission_classes = [IsAuthenticated]

    # Filtering, searching, and ordering capabilities
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['asset_code', 'name', 'description', 'location']
    ordering_fields = ['created_at', 'acquisition_date', 'acquisition_cost', 'name']
    ordering = ['-created_at']

    def get_serializer_class(self):
        """
        Use the lightweight serializer for list view,
        and the full detail serializer for retrieve/create/update.
        """
        if self.action == 'list':
            return AssetListSerializer
        return AssetDetailSerializer

    def perform_create(self, serializer):
        """Automatically set created_by to the logged-in user."""
        serializer.save(created_by=self.request.user)

    # Custom action: list valuations for one asset
    @action(detail=True, methods=['get'])
    def valuations(self, request, pk=None):
        """
        GET /api/assets/<id>/valuations/
        Returns all valuations for a specific asset.
        """
        asset = self.get_object()
        valuations = asset.valuations.all()
        serializer = AssetValuationSerializer(valuations, many=True)
        return Response(serializer.data)

    # Custom action: list events for one asset
    @action(detail=True, methods=['get'])
    def events(self, request, pk=None):
        """
        GET /api/assets/<id>/events/
        Returns all lifecycle events for a specific asset.
        """
        asset = self.get_object()
        events = asset.events.all()
        serializer = AssetEventSerializer(events, many=True)
        return Response(serializer.data)

    # Custom action: summary statistics
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        GET /api/assets/stats/
        Returns dashboard statistics for assets.
        """
        from django.db.models import Sum, Count

        total_assets = Asset.objects.count()
        active_assets = Asset.objects.filter(status=Asset.STATUS_ACTIVE).count()
        disposed_assets = Asset.objects.filter(status=Asset.STATUS_DISPOSED).count()
        total_value = Asset.objects.aggregate(
            total=Sum('acquisition_cost')
        )['total'] or 0

        # Count by category
        by_category = list(
            Asset.objects.values('category')
            .annotate(count=Count('id'), total_value=Sum('acquisition_cost'))
            .order_by('-count')
        )

        return Response({
            'total_assets': total_assets,
            'active_assets': active_assets,
            'disposed_assets': disposed_assets,
            'total_acquisition_value': total_value,
            'by_category': by_category,
        })


# ASSET VALUATION VIEWSET — full CRUD for valuations
class AssetValuationViewSet(viewsets.ModelViewSet):
    """CRUD for asset valuations."""

    queryset = AssetValuation.objects.all().select_related('asset', 'performed_by')
    serializer_class = AssetValuationSerializer
    permission_classes = [IsAuthenticated]

    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['asset__asset_code', 'asset__name', 'notes']
    ordering_fields = ['valuation_date', 'created_at']
    ordering = ['-valuation_date']

    def perform_create(self, serializer):
        """Set performed_by to logged-in user automatically."""
        serializer.save(performed_by=self.request.user)


# ASSET EVENT VIEWSET — full CRUD for lifecycle events
class AssetEventViewSet(viewsets.ModelViewSet):
    """CRUD for asset lifecycle events."""

    queryset = AssetEvent.objects.all().select_related('asset', 'recorded_by')
    serializer_class = AssetEventSerializer
    permission_classes = [IsAuthenticated]

    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['asset__asset_code', 'asset__name', 'description']
    ordering_fields = ['event_date', 'created_at']
    ordering = ['-event_date']

    def perform_create(self, serializer):
        """Set recorded_by to logged-in user automatically."""
        serializer.save(recorded_by=self.request.user)