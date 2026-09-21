"""
INTEGRATION APP — Serializers

Two groups of serializers live here:

1. EXTERNAL serializers — read-only views of Asset and Depreciation
   data shaped specifically for what Stephen's lease/budget system
   needs. We deliberately exclude internal-only fields (created_by,
   image, raw URLs) and add computed fields like current_nbv so the
   consumer doesn't need to do the math themselves.

2. INTERNAL admin serializers — for Patrick (or the admin) to manage
   IntegrationClients and view IntegrationLogs from the React frontend.
   These are protected by JWT, not by X-API-Key.
"""

from rest_framework import serializers
from decimal import Decimal

from assets.models import Asset, AssetValuation, AssetEvent
from depreciation.models import DepreciationPolicy, DepreciationSchedule
from .models import IntegrationClient, IntegrationLog


# EXTERNAL SERIALIZERS — what Stephen's system sees

class IntegrationAssetValuationSerializer(serializers.ModelSerializer):
    """A single historical valuation, in a form safe to expose externally."""

    method_display = serializers.CharField(source='get_method_display', read_only=True)

    class Meta:
        model = AssetValuation
        fields = [
            'id', 'valuation_date',
            'market_value', 'fair_value',
            'method', 'method_display',
            'notes',
        ]


class IntegrationDepreciationScheduleSerializer(serializers.ModelSerializer):
    """One row of the year-by-year depreciation schedule for an asset."""

    class Meta:
        model = DepreciationSchedule
        fields = [
            'period_year',
            'opening_nbv',
            'depreciation_amount',
            'accumulated_depreciation',
            'closing_nbv',
            'units_used',
        ]


class IntegrationAssetListSerializer(serializers.ModelSerializer):
    """
    Lightweight asset row for the list endpoint.

    Includes only the fields a lease/budget system actually needs:
    identification, category, location, status, financial baseline,
    and the most recent NBV from the depreciation engine (so the
    consumer can value a lease against an up-to-date book value
    without a second call).
    """

    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    # Most recent Net Book Value — computed below.
    current_nbv = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        fields = [
            'id', 'asset_code', 'name',
            'category', 'category_display',
            'location', 'status', 'status_display',
            'acquisition_date', 'acquisition_cost',
            'useful_life_years', 'residual_value',
            'current_nbv',
            'created_at', 'updated_at',
        ]

    def get_current_nbv(self, obj):
        """
        Find the most recent depreciation schedule row across any of
        this asset's policies and return its closing_nbv. If the asset
        has no depreciation schedule yet, fall back to the original
        acquisition cost (which is the book value before depreciation).
        """
        latest_row = (
            DepreciationSchedule.objects
            .filter(policy__asset=obj)
            .order_by('-period_year')
            .first()
        )
        if latest_row:
            return latest_row.closing_nbv
        return obj.acquisition_cost


class IntegrationAssetDetailSerializer(IntegrationAssetListSerializer):
    """
    Detail view of one asset.

    Extends the list serializer with the full valuation history and
    the most recent depreciation schedule, so Stephen's system can do
    deeper analysis (e.g. "what was this building worth last year?").
    """

    # Nested history — read-only
    valuations = IntegrationAssetValuationSerializer(many=True, read_only=True)

    # The depreciation schedule of the asset's active policy (if any)
    depreciation_schedule = serializers.SerializerMethodField()

    # The method currently used to depreciate this asset (SLM/DBM/UPM)
    depreciation_method = serializers.SerializerMethodField()

    class Meta(IntegrationAssetListSerializer.Meta):
        fields = IntegrationAssetListSerializer.Meta.fields + [
            'description',
            'depreciation_method',
            'depreciation_schedule',
            'valuations',
        ]

    def get_depreciation_method(self, obj):
        """Return the method of the asset's most recent ACTIVE policy."""
        policy = obj.depreciation_policies.filter(
            status=DepreciationPolicy.STATUS_ACTIVE
        ).order_by('-created_at').first()
        if not policy:
            return None
        return policy.get_method_display()

    def get_depreciation_schedule(self, obj):
        """Return schedule rows of the asset's most recent active policy."""
        policy = obj.depreciation_policies.filter(
            status=DepreciationPolicy.STATUS_ACTIVE
        ).order_by('-created_at').first()
        if not policy:
            return []
        schedule = policy.schedules.all().order_by('period_year')
        return IntegrationDepreciationScheduleSerializer(schedule, many=True).data


# INTERNAL ADMIN SERIALIZERS — what Patrick sees in the React UI

class IntegrationClientSerializer(serializers.ModelSerializer):
    """
    Full client record for admin management.

    The api_key is read-only — it is generated on create and can only
    be rotated via the dedicated rotate_key endpoint, never edited by
    hand (which would let an admin set a guessable value).
    """

    log_count = serializers.SerializerMethodField()

    class Meta:
        model = IntegrationClient
        fields = [
            'id', 'name', 'description', 'contact_email',
            'api_key', 'is_active', 'last_used_at',
            'log_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'api_key', 'last_used_at', 'created_at', 'updated_at']

    def get_log_count(self, obj):
        return obj.logs.count()


class IntegrationLogSerializer(serializers.ModelSerializer):
    """Audit log row for the admin UI."""

    client_name = serializers.CharField(source='client.name', read_only=True, default='unknown')

    class Meta:
        model = IntegrationLog
        fields = [
            'id', 'client', 'client_name',
            'method', 'endpoint', 'status_code',
            'ip_address', 'message', 'called_at',
        ]
        read_only_fields = fields
