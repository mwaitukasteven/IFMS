"""
PROPERTIES APP — Views

Two viewsets:
  1. BuildingViewSet — read-only list of assets with category='building',
     served to Lease Officers when creating a lease. This replaces the
     old Property list.
  2. PropertyUnitViewSet — CRUD for building sub-units.
"""

from rest_framework import viewsets

from assets.models import Asset
from users.permissions import IsAdminOrLeaseOfficer, IsAdminOrReadOnly
from .models import PropertyUnit
from .serializers import BuildingSerializer, PropertyUnitSerializer


class BuildingViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only listing of building assets available to the Lease module.

    Assets are OWNED by the assets app (registered by the Asset Manager).
    This viewset is just a convenience filter so the Lease Officer sees
    only buildings — not vehicles or equipment.
    """

    queryset = Asset.objects.filter(category=Asset.CATEGORY_BUILDING)
    serializer_class = BuildingSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()

        # available_for_lease=true → active building not currently leased
        available = self.request.query_params.get('available_for_lease')
        if available == 'true':
            qs = qs.filter(status=Asset.STATUS_ACTIVE).exclude(
                lease_agreements__status='active'
            )

        return qs.distinct()


class PropertyUnitViewSet(viewsets.ModelViewSet):
    queryset = PropertyUnit.objects.select_related('property').all()
    serializer_class = PropertyUnitSerializer
    permission_classes = [IsAdminOrLeaseOfficer]

    def get_queryset(self):
        qs = super().get_queryset()
        building_id = self.request.query_params.get('property') or self.request.query_params.get('building')
        if building_id:
            qs = qs.filter(property_id=building_id)
        available = self.request.query_params.get('available')
        if available == 'true':
            qs = qs.filter(is_occupied=False)
        return qs
