from decimal import Decimal

from django.test import TestCase
from rest_framework.exceptions import ValidationError

from .serializers import validate_payment_amount


class PaymentValidationTests(TestCase):
    def test_full_payment_requires_the_full_invoice_amount(self):
        with self.assertRaises(ValidationError):
            validate_payment_amount(Decimal('100000.00'), Decimal('90000.00'), 'full')

    def test_partial_payment_allows_any_amount_up_to_the_invoice_total(self):
        validate_payment_amount(Decimal('100000.00'), Decimal('65000.00'), 'partial')

    def test_partial_payment_cannot_exceed_the_invoice_total(self):
        with self.assertRaises(ValidationError):
            validate_payment_amount(Decimal('100000.00'), Decimal('100001.00'), 'partial')
