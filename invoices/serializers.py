from decimal import Decimal

from rest_framework import serializers

from .models import Invoice, InvoiceBankDetail


def calculate_total_lease_rent(lease):
    rent_amount = Decimal(str(lease.monthly_rent))
    months = (lease.end_date.year - lease.start_date.year) * 12 + (lease.end_date.month - lease.start_date.month)
    month_count = months + 1 if lease.end_date.day > lease.start_date.day else max(months, 1)
    return (rent_amount * Decimal(month_count)).quantize(Decimal('0.01'))


class InvoiceBankDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceBankDetail
        fields = '__all__'


class InvoiceSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='lease.tenant.full_name', read_only=True)
    property_name = serializers.CharField(source='lease.property.name', read_only=True)
    total_rent = serializers.SerializerMethodField()
    amount_paid = serializers.SerializerMethodField()
    amount_due = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = '__all__'

    def get_total_rent(self, obj):
        return calculate_total_lease_rent(obj.lease)

    def get_amount_paid(self, obj):
        """Get total amount already paid for this invoice"""
        from django.db.models import Sum
        from payments.models import Payment
        
        total_paid = Payment.objects.filter(
            invoice=obj
        ).aggregate(total=Sum('amount_paid'))['total'] or Decimal('0')
        return Decimal(str(total_paid)).quantize(Decimal('0.01'))

    def get_amount_due(self, obj):
        """Get remaining amount due for this invoice"""
        from django.db.models import Sum
        from payments.models import Payment
        
        total_paid = Payment.objects.filter(
            invoice=obj
        ).aggregate(total=Sum('amount_paid'))['total'] or Decimal('0')
        remaining = Decimal(str(obj.amount)) - Decimal(str(total_paid))
        return remaining.quantize(Decimal('0.01'))
