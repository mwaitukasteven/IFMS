"""
PROPERTIES APP — Serializers

Exposes two things to the lease-side of the merged system:
  1. Buildings — read-only, sourced from assets.Asset filtered to
     category='building' (this is what the Lease Officer picks from
     when creating a lease).
  2. PropertyUnit — subdivisions of a building.
"""

from rest_framework import serializers

from assets.models import Asset
from .models import PropertyUnit


class BuildingSerializer(serializers.ModelSerializer):
    """Read-only view of a building (Asset with category='building')."""

    # Frontend legacy aliases — old ASSET code expects these names.
    asset_name = serializers.CharField(source='name', read_only=True)
    available_for_lease = serializers.SerializerMethodField()
    unit_count = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        fields = [
            'id', 'asset_code', 'name', 'asset_name', 'description',
            'category', 'location', 'status', 'acquisition_date',
            'acquisition_cost', 'available_for_lease', 'unit_count',
        ]
        read_only_fields = fields

    def get_available_for_lease(self, obj):
        # Available when active, a building, and not tied to an active lease
        if obj.status != Asset.STATUS_ACTIVE or obj.category != Asset.CATEGORY_BUILDING:
            return False
        return not obj.lease_agreements.filter(status='active').exists() \
            if hasattr(obj, 'lease_agreements') else True

    def get_unit_count(self, obj):
        return obj.units.count() if hasattr(obj, 'units') else 0


class PropertyUnitSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)

    class Meta:
        model = PropertyUnit
        fields = '__all__'
