from decimal import Decimal
from datetime import date

from rest_framework import serializers

from .models import LeaseAgreement


def calculate_lease_total_rent(lease):
    """Total rent = monthly_rent × number of months between start & end."""
    rent_amount = Decimal(str(lease.monthly_rent))
    start_date = lease.start_date
    end_date = lease.end_date

    months = (end_date.year - start_date.year) * 12 + (end_date.month - start_date.month)
    if end_date.day > start_date.day:
        month_count = months + 1
    else:
        month_count = max(months, 1)

    return (rent_amount * Decimal(month_count)).quantize(Decimal('0.01'))


class LeaseAgreementSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.full_name', read_only=True)
    # Property points to assets.Asset now — expose both the modern
    # `name` and the legacy `asset_name` alias for the frontend.
    property_name = serializers.CharField(source='property.name', read_only=True)
    property_code = serializers.CharField(source='property.asset_code', read_only=True)
    property_location = serializers.CharField(source='property.location', read_only=True)
    unit_number = serializers.CharField(source='unit.unit_number', read_only=True, allow_null=True)
    lease_manager_name = serializers.CharField(source='lease_manager.get_full_name', read_only=True)
    total_rent = serializers.SerializerMethodField()
    bank_name = serializers.SerializerMethodField()
    bank_account_number = serializers.SerializerMethodField()

    class Meta:
        model = LeaseAgreement
        fields = '__all__'

    def get_total_rent(self, obj):
        return calculate_lease_total_rent(obj)

    def _lease_invoice(self, obj):
        # The bank details on the lease are carried by its invoice.
        # Prefer the most recent invoice that actually has bank details filled in.
        return (
            obj.invoice_set.exclude(bank_name='')
            .order_by('-created_at')
            .first()
            or obj.invoice_set.order_by('-created_at').first()
        )

    def get_bank_name(self, obj):
        invoice = self._lease_invoice(obj)
        return invoice.bank_name if invoice else ''

    def get_bank_account_number(self, obj):
        invoice = self._lease_invoice(obj)
        return invoice.bank_account_number if invoice else ''

    def validate(self, attrs):
        from assets.models import Asset

        property_obj = attrs.get('property') or getattr(self.instance, 'property', None)
        unit = attrs.get('unit')

        if property_obj and property_obj.category != Asset.CATEGORY_BUILDING:
            raise serializers.ValidationError(
                {'property': 'Only building assets can be leased.'}
            )

        if property_obj and property_obj.status != Asset.STATUS_ACTIVE:
            raise serializers.ValidationError(
                {'property': 'This asset is not active and cannot be leased.'}
            )

        if property_obj:
            active_lease = property_obj.lease_agreements.filter(status='active')
            if self.instance:
                active_lease = active_lease.exclude(pk=self.instance.pk)
            if not unit and active_lease.exists():
                raise serializers.ValidationError(
                    {'property': 'This building already has an active whole-building lease.'}
                )

        if unit and property_obj and unit.property_id != property_obj.id:
            raise serializers.ValidationError(
                {'unit': 'Unit does not belong to the selected building.'}
            )

        if unit and unit.is_occupied:
            if not self.instance or self.instance.unit_id != unit.id:
                raise serializers.ValidationError({'unit': 'Room already occupied.'})

        start_date = attrs.get('start_date') or getattr(self.instance, 'start_date', None)
        end_date = attrs.get('end_date') or getattr(self.instance, 'end_date', None)
        if start_date and end_date and end_date <= start_date:
            raise serializers.ValidationError(
                {'end_date': 'End date must be after start date.'}
            )

        return attrs
