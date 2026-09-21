from datetime import date, timedelta

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from users.permissions import IsAdminOrLeaseOfficer, IsTenant
from notifications.services import notify_invoice_issued
from .models import Invoice, InvoiceBankDetail
from .serializers import InvoiceSerializer, InvoiceBankDetailSerializer


def generate_invoice_number():
    last_invoice = Invoice.objects.order_by('-id').first()
    if not last_invoice:
        return 'INV-000001'
    return f'INV-{last_invoice.id + 1:06d}'


class InvoiceBankDetailViewSet(viewsets.ModelViewSet):
    queryset = InvoiceBankDetail.objects.all()
    serializer_class = InvoiceBankDetailSerializer
    permission_classes = [IsAdminOrLeaseOfficer]


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.select_related('lease', 'bank_detail').all()
    serializer_class = InvoiceSerializer
    permission_classes = [IsAdminOrLeaseOfficer]

    def perform_create(self, serializer):
        if not serializer.validated_data.get('invoice_number'):
            invoice = serializer.save(invoice_number=generate_invoice_number())
        else:
            invoice = serializer.save()
        notify_invoice_issued(invoice)

    def perform_update(self, serializer):
        invoice = serializer.save()
        if invoice.due_date < date.today() and invoice.status == 'pending':
            invoice.status = 'overdue'
            invoice.save(update_fields=['status'])


class MyInvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated, IsTenant]

    def get_queryset(self):
        return Invoice.objects.select_related(
            'lease__property', 'lease__tenant',
        ).filter(lease__tenant__user=self.request.user).order_by('-issue_date')
