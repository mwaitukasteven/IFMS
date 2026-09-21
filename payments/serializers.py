from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from invoices.models import Invoice
from .models import Payment, PaymentConfirmation


def validate_payment_amount(invoice, amount_paid, payment_type):
    from django.db.models import Sum
    from payments.models import Payment
    
    amount_paid = Decimal(str(amount_paid))
    invoice_amount = Decimal(str(invoice.amount))
    
    # Calculate total already paid
    total_paid = Payment.objects.filter(
        invoice=invoice
    ).aggregate(total=Sum('amount_paid'))['total'] or Decimal('0')
    total_paid = Decimal(str(total_paid))
    
    # Calculate remaining amount due
    remaining_amount = invoice_amount - total_paid

    if amount_paid <= 0:
        raise serializers.ValidationError('Payment amount must be greater than zero.')

    if payment_type == 'full' and amount_paid != remaining_amount:
        raise serializers.ValidationError(f'Full-payment confirmations must match the remaining amount due: {remaining_amount:.2f}.')

    if payment_type == 'partial' and amount_paid > remaining_amount:
        raise serializers.ValidationError(f'Partial payments cannot exceed the remaining amount due: {remaining_amount:.2f}.')

    return amount_paid


class PaymentSerializer(
    serializers.ModelSerializer
):
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)

    class Meta:

        model = Payment

        fields = ['id', 'invoice', 'invoice_number', 'amount_paid', 'payment_date', 'payment_method', 'created_at']


class PaymentConfirmationSerializer(serializers.ModelSerializer):
    invoice_number_display = serializers.CharField(source='invoice.invoice_number', read_only=True)
    tenant_name = serializers.CharField(source='invoice.lease.tenant.full_name', read_only=True)
    property_name = serializers.CharField(source='invoice.lease.property.name', read_only=True)
    confirmed_by_name = serializers.CharField(source='confirmed_by.get_full_name', read_only=True, allow_null=True)

    class Meta:
        model = PaymentConfirmation
        fields = [
            'id', 'invoice', 'invoice_number', 'invoice_number_display', 'amount_paid', 'payment_type',
            'payment_date', 'payment_method', 'reference_number', 'payment_note', 'status', 'confirmed_by',
            'confirmed_by_name', 'tenant_name', 'property_name', 'created_at', 'confirmed_at'
        ]
        read_only_fields = ['confirmed_by', 'confirmed_at', 'status', 'created_at']
        extra_kwargs = {
            'invoice_number': {'required': False, 'allow_blank': True},
        }

    def validate(self, attrs):
        invoice = attrs.get('invoice') or getattr(self.instance, 'invoice', None)
        amount_paid = attrs.get('amount_paid', getattr(self.instance, 'amount_paid', None))
        payment_type = attrs.get('payment_type', getattr(self.instance, 'payment_type', 'partial'))

        if invoice is None:
            raise serializers.ValidationError({'invoice': 'Invoice is required.'})

        if amount_paid is None:
            raise serializers.ValidationError({'amount_paid': 'Amount paid is required.'})

        try:
            validate_payment_amount(invoice, amount_paid, payment_type)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'amount_paid': exc.messages}) from exc
        except serializers.ValidationError as exc:
            raise serializers.ValidationError({'amount_paid': exc.detail}) from exc

        return attrs