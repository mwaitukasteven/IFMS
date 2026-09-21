from decimal import Decimal
from datetime import datetime

from django.db.models import Sum
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from users.permissions import IsAdminOrLeaseOfficer, IsAdminOrLeaseOrFinance, IsTenant
from invoices.models import Invoice
from notifications.services import notify_payment_confirmed, notify_payment_rejected
from .models import Payment, PaymentConfirmation
from .serializers import PaymentSerializer, PaymentConfirmationSerializer


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related('invoice__lease__tenant').all()
    serializer_class = PaymentSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAdminOrLeaseOrFinance()]
        return [IsAdminOrLeaseOfficer()]

    def perform_create(self, serializer):
        payment = serializer.save()
        self._sync_invoice_status(payment.invoice)

    def perform_update(self, serializer):
        old_invoice_id = self.get_object().invoice_id
        payment = serializer.save()
        self._sync_invoice_status(payment.invoice)
        if old_invoice_id != payment.invoice_id:
            old_invoice = Invoice.objects.filter(pk=old_invoice_id).first()
            if old_invoice:
                self._sync_invoice_status(old_invoice)

    def perform_destroy(self, instance):
        invoice = instance.invoice
        super().perform_destroy(instance)
        self._sync_invoice_status(invoice)

    def _sync_invoice_status(self, invoice):
        total_paid = invoice.payment_set.aggregate(
            total=Sum('amount_paid')
        )['total'] or Decimal('0')

        if total_paid >= invoice.amount:
            invoice.status = 'paid'
        elif invoice.status == 'paid':
            invoice.status = 'pending'
        invoice.save(update_fields=['status'])


class PaymentConfirmationViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentConfirmationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'tenant':
            # Tenants see their own payment confirmations
            return PaymentConfirmation.objects.filter(
                invoice__lease__tenant__user=user
            ).select_related('invoice__lease__tenant', 'invoice__lease__property', 'confirmed_by')
        elif user.role in ('lease_officer', 'admin'):
            # Lease officers see all payment confirmations
            return PaymentConfirmation.objects.select_related(
                'invoice__lease__tenant', 'invoice__lease__property', 'confirmed_by'
            )
        return PaymentConfirmation.objects.none()

    def get_permissions(self):
        if self.action == 'create':
            return [IsAuthenticated(), IsTenant()]
        elif self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        elif self.action in ('confirm_payment', 'reject_payment'):
            return [IsAdminOrLeaseOfficer()]
        return [IsAdminOrLeaseOfficer()]

    def create(self, request, *args, **kwargs):
        """Tenant submits payment confirmation"""
        invoice_id = request.data.get('invoice')
        
        # Verify tenant owns this invoice
        try:
            invoice = Invoice.objects.select_related('lease__tenant').get(id=invoice_id)
            if invoice.lease.tenant.user != request.user:
                return Response(
                    {'detail': 'You can only submit payment confirmations for your own invoices.'},
                    status=status.HTTP_403_FORBIDDEN
                )
        except Invoice.DoesNotExist:
            return Response(
                {'detail': 'Invoice not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrLeaseOfficer()])
    def confirm_payment(self, request, pk=None):
        """Lease officer confirms the payment"""
        confirmation = self.get_object()
        
        if confirmation.status != 'pending':
            return Response(
                {'detail': f'Can only confirm pending payments. Current status: {confirmation.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        existing_paid = confirmation.invoice.payment_set.aggregate(
            total=Sum('amount_paid')
        )['total'] or Decimal('0')
        remaining_amount = confirmation.invoice.amount - existing_paid

        if confirmation.amount_paid > remaining_amount:
            return Response(
                {'detail': 'The confirmed payment exceeds the outstanding invoice amount.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if confirmation.payment_type == 'full' and confirmation.amount_paid != remaining_amount:
            return Response(
                {'detail': f'A full-payment confirmation must match the remaining amount due: {remaining_amount:.2f}.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create actual Payment record
        payment = Payment.objects.create(
            invoice=confirmation.invoice,
            amount_paid=confirmation.amount_paid,
            payment_date=confirmation.payment_date,
            payment_method=confirmation.payment_method,
            reference_number=confirmation.reference_number
        )

        # Update confirmation
        confirmation.status = 'confirmed'
        confirmation.confirmed_by = request.user
        confirmation.confirmed_at = datetime.now()
        confirmation.save()

        # Sync invoice status
        self._sync_invoice_status(confirmation.invoice)

        # Notify tenant (in-app + email)
        notify_payment_confirmed(confirmation)

        return Response({
            'message': 'Payment confirmed successfully',
            'payment_id': payment.id,
            'confirmation': PaymentConfirmationSerializer(confirmation).data
        })

    @action(detail=False, methods=['post'], permission_classes=[IsAdminOrLeaseOfficer()])
    def record_cash_payment(self, request):
        """
        Lease officer records a payment on behalf of a tenant who cannot use
        the self-service flow (e.g. paid in cash at the office, no smartphone).
        Supported methods: cash, bank transfer, mobile transfer.

        - cash: reference is auto-recorded as '-' (no transaction ID exists).
        - bank transfer / mobile transfer: a reference number is required so
          the payment can be reconciled with the bank/telco statement.

        Endpoint name kept for backward compat; despite `record_cash_payment`
        it accepts any officer-recorded method. Tenant-facing flow untouched.
        """
        ALLOWED_METHODS = {'cash', 'bank transfer', 'mobile transfer'}
        NO_REFERENCE_METHODS = {'cash'}

        invoice_id = request.data.get('invoice')
        amount_paid = request.data.get('amount_paid')
        payment_date = request.data.get('payment_date') or datetime.now().date().isoformat()
        payment_note = request.data.get('payment_note', '')
        payment_method = (request.data.get('payment_method') or 'cash').strip().lower()
        raw_reference = (request.data.get('reference_number') or '').strip()

        if payment_method not in ALLOWED_METHODS:
            return Response(
                {'detail': f'Payment method must be one of: {", ".join(sorted(ALLOWED_METHODS))}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Cash has no transaction ID — force reference to '-'. For other
        # methods a real reference is required.
        if payment_method in NO_REFERENCE_METHODS:
            reference_number = '-'
        else:
            if not raw_reference or raw_reference == '-':
                return Response(
                    {'detail': f'Reference number is required for {payment_method}.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            reference_number = raw_reference

        if not invoice_id:
            return Response({'detail': 'Invoice is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if amount_paid in (None, ''):
            return Response({'detail': 'Amount paid is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            invoice = Invoice.objects.select_related('lease__tenant').get(id=invoice_id)
        except Invoice.DoesNotExist:
            return Response({'detail': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            amount = Decimal(str(amount_paid))
        except Exception:
            return Response({'detail': 'Invalid amount.'}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= 0:
            return Response({'detail': 'Amount must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)

        existing_paid = invoice.payment_set.aggregate(total=Sum('amount_paid'))['total'] or Decimal('0')
        remaining_amount = invoice.amount - existing_paid
        if amount > remaining_amount:
            return Response(
                {'detail': f'Amount exceeds outstanding balance: {remaining_amount:.2f}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payment_type = 'full' if amount == remaining_amount else 'partial'

        confirmation = PaymentConfirmation.objects.create(
            invoice=invoice,
            invoice_number=invoice.invoice_number,
            amount_paid=amount,
            payment_type=payment_type,
            payment_date=payment_date,
            payment_method=payment_method,
            reference_number=reference_number,
            payment_note=payment_note,
            status='confirmed',
            confirmed_by=request.user,
            confirmed_at=datetime.now(),
        )

        payment = Payment.objects.create(
            invoice=invoice,
            amount_paid=amount,
            payment_date=payment_date,
            payment_method=payment_method,
            reference_number=reference_number,
        )

        self._sync_invoice_status(invoice)

        return Response({
            'message': f'{payment_method.title()} payment recorded successfully',
            'payment_id': payment.id,
            'confirmation': PaymentConfirmationSerializer(confirmation).data,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrLeaseOfficer()])
    def reject_payment(self, request, pk=None):
        """Lease officer rejects the payment confirmation"""
        confirmation = self.get_object()
        
        if confirmation.status != 'pending':
            return Response(
                {'detail': f'Can only reject pending payments. Current status: {confirmation.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        confirmation.status = 'rejected'
        confirmation.confirmed_by = request.user
        confirmation.confirmed_at = datetime.now()
        confirmation.save()

        # Notify tenant (in-app + email)
        reason = request.data.get('reason', '') if hasattr(request, 'data') else ''
        notify_payment_rejected(confirmation, reason)

        return Response({
            'message': 'Payment confirmation rejected',
            'confirmation': PaymentConfirmationSerializer(confirmation).data
        })

    def _sync_invoice_status(self, invoice):
        """Update invoice status based on total payments"""
        total_paid = invoice.payment_set.aggregate(
            total=Sum('amount_paid')
        )['total'] or Decimal('0')

        if total_paid >= invoice.amount:
            invoice.status = 'paid'
        elif invoice.status == 'paid':
            invoice.status = 'pending'
        invoice.save(update_fields=['status'])
