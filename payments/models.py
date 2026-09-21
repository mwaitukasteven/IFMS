from django.db import models
from django.contrib.auth import get_user_model
from invoices.models import Invoice

User = get_user_model()


class Payment(models.Model):

    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE
    )

    amount_paid = models.DecimalField(
        max_digits=15,
        decimal_places=2
    )

    payment_date = models.DateField()

    payment_method = models.CharField(
        max_length=100
    )

    reference_number = models.CharField(
        max_length=100
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )


class PaymentConfirmation(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('rejected', 'Rejected'),
    )

    PAYMENT_TYPE_CHOICES = (
        ('full', 'Full Amount'),
        ('partial', 'Partial Amount'),
    )

    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name='payment_confirmations'
    )

    invoice_number = models.CharField(
        max_length=100,
        help_text='Invoice number supplied by the tenant'
    )

    amount_paid = models.DecimalField(
        max_digits=15,
        decimal_places=2
    )

    payment_type = models.CharField(
        max_length=20,
        choices=PAYMENT_TYPE_CHOICES,
        default='partial'
    )

    payment_date = models.DateField()

    payment_method = models.CharField(
        max_length=100,
        default='bank transfer'
    )

    reference_number = models.CharField(
        max_length=100,
        help_text="Invoice reference number or transaction ID"
    )

    payment_note = models.TextField(
        blank=True,
        default=''
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )

    confirmed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='confirmed_payments',
        help_text="Lease officer who confirmed the payment"
    )

    confirmed_at = models.DateTimeField(
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Payment Confirmation for {self.invoice.invoice_number} - {self.status}"