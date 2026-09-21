from django.db import models
from leases.models import LeaseAgreement

class InvoiceBankDetail(models.Model):

    bank_name = models.CharField(
        max_length=100
    )

    account_name = models.CharField(
        max_length=255
    )

    account_number = models.CharField(
        max_length=100
    )

    is_active = models.BooleanField(
        default=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return self.bank_name

class Invoice(models.Model):

    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('overdue', 'Overdue'),
    )

    lease = models.ForeignKey(
        LeaseAgreement,
        on_delete=models.CASCADE
    )

    invoice_number = models.CharField(
        max_length=100,
        unique=True
    )

    amount = models.DecimalField(
        max_digits=15,
        decimal_places=2
    )

    issue_date = models.DateField()

    due_date = models.DateField()

    bank_detail = models.ForeignKey(
    InvoiceBankDetail,
    on_delete=models.PROTECT,
    null=True,
    blank=True)

    bank_name = models.CharField(
        max_length=100,
        blank=True,
        default=''
    )

    bank_account_number = models.CharField(
        max_length=100,
        blank=True,
        default=''
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

