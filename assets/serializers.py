"""
ASSETS APP — Serializers

Converts Asset, AssetValuation, and AssetEvent models to/from JSON.
"""

from rest_framework import serializers
from .models import Asset, AssetValuation, AssetEvent


# COMMA-TOLERANT DECIMAL FIELD
# Users entering currency values find it natural to type thousands separators
# (e.g. "10,000,000.00" rather than "10000000.00"). DRF's default DecimalField
# rejects commas, so we provide this small subclass that strips them on input
# before the parent class does its usual numeric validation. Output is left
# untouched — the API still returns plain decimal strings so the frontend can
# format them however it likes.
class CommaDecimalField(serializers.DecimalField):
    def to_internal_value(self, data):
        if isinstance(data, str):
            # Drop every comma anywhere in the string. Strict validation
            # (e.g. requiring commas in groups of three) would just frustrate
            # users for no real safety gain — we still validate the resulting
            # number is a proper decimal.
            data = data.replace(',', '')
        return super().to_internal_value(data)


# ASSET VALUATION SERIALIZER
class AssetValuationSerializer(serializers.ModelSerializer):
    """Serializes AssetValuation records."""

    # Money fields accept comma-separated input like "10,000,000.00"
    market_value = CommaDecimalField(max_digits=15, decimal_places=2)
    fair_value = CommaDecimalField(max_digits=15, decimal_places=2)

    # Display friendly name for valuation method
    method_display = serializers.CharField(source='get_method_display', read_only=True)

    # Show name of user who performed the valuation
    performed_by_name = serializers.CharField(
        source='performed_by.full_name', read_only=True, default=''
    )

    class Meta:
        model = AssetValuation
        fields = [
            'id', 'asset', 'valuation_date',
            'market_value', 'fair_value',
            'method', 'method_display', 'notes',
            'performed_by', 'performed_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'performed_by', 'created_at', 'updated_at']


# ASSET EVENT SERIALIZER
class AssetEventSerializer(serializers.ModelSerializer):
    """Serializes AssetEvent lifecycle records."""

    # Money field accepts comma-separated input like "1,500,000.00"
    amount = CommaDecimalField(max_digits=15, decimal_places=2, required=False)

    # Friendly display for event type
    event_type_display = serializers.CharField(
        source='get_event_type_display', read_only=True
    )

    # Show name of user who recorded the event
    recorded_by_name = serializers.CharField(
        source='recorded_by.full_name', read_only=True, default=''
    )

    class Meta:
        model = AssetEvent
        fields = [
            'id', 'asset', 'event_type', 'event_type_display',
            'event_date', 'amount', 'description',
            'recorded_by', 'recorded_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'recorded_by', 'created_at', 'updated_at']


# ASSET SERIALIZER (BASIC — for listing assets)
class AssetListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for asset listings.
    Excludes detailed nested data for faster list responses.
    """

    # Money fields accept comma-separated input like "10,000,000.00"
    acquisition_cost = CommaDecimalField(max_digits=15, decimal_places=2)
    residual_value = CommaDecimalField(max_digits=15, decimal_places=2, required=False)

    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    valuation_method_display = serializers.CharField(
        source='get_valuation_method_display', read_only=True
    )
    created_by_name = serializers.CharField(
        source='created_by.full_name', read_only=True, default=''
    )

    class Meta:
        model = Asset
        fields = [
            'id', 'asset_code', 'name', 'category', 'category_display',
            'location', 'acquisition_date', 'acquisition_cost',
            'useful_life_years', 'residual_value',
            'valuation_method', 'valuation_method_display',
            'status', 'status_display',
            'image', 'created_by', 'created_by_name',
            'created_at', 'updated_at',
        ]
        # asset_code is auto-generated in Asset.save() — clients never send it
        read_only_fields = ['id', 'asset_code', 'created_by', 'created_at', 'updated_at']

    def validate(self, attrs):
        # Residual value must never exceed acquisition cost — otherwise the
        # depreciable base would be negative and every downstream schedule
        # would produce nonsense numbers. Compare against the incoming values,
        # falling back to what's already stored when only one field is being
        # updated.
        acquisition_cost = attrs.get(
            'acquisition_cost',
            getattr(self.instance, 'acquisition_cost', None),
        )
        residual_value = attrs.get(
            'residual_value',
            getattr(self.instance, 'residual_value', None),
        )
        if (
            acquisition_cost is not None
            and residual_value is not None
            and residual_value > acquisition_cost
        ):
            raise serializers.ValidationError(
                {'residual_value': (
                    f'Residual value ({residual_value}) cannot be greater than '
                    f'acquisition cost ({acquisition_cost}).'
                )}
            )
        return attrs


# ASSET DETAIL SERIALIZER — with nested valuations and events
class AssetDetailSerializer(AssetListSerializer):
    """
    Full asset details including all valuations and lifecycle events.
    Used for the asset detail page.
    """

    # Nested list of all valuations for this asset
    valuations = AssetValuationSerializer(many=True, read_only=True)

    # Nested list of all lifecycle events for this asset
    events = AssetEventSerializer(many=True, read_only=True)

    # Computed field — count of valuations
    valuation_count = serializers.SerializerMethodField()

    # Computed field — count of events
    event_count = serializers.SerializerMethodField()

    # Computed field — latest market value (if any valuations exist)
    latest_market_value = serializers.SerializerMethodField()

    class Meta(AssetListSerializer.Meta):
        fields = AssetListSerializer.Meta.fields + [
            'description',
            'valuations', 'events',
            'valuation_count', 'event_count', 'latest_market_value',
        ]

    def get_valuation_count(self, obj):
        return obj.valuations.count()

    def get_event_count(self, obj):
        return obj.events.count()

    def get_latest_market_value(self, obj):
        """Return the most recent market value, or None if no valuations."""
        latest = obj.get_latest_valuation()
        return latest.market_value if latest else None