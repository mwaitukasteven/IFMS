from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone

from payments.models import Payment


def get_revenue_for_year(year=None):
    """Total confirmed payments (revenue) for a given year or all time."""
    qs = Payment.objects.all()
    if year:
        qs = qs.filter(payment_date__year=int(year))
    return qs.aggregate(total=Sum('amount_paid'))['total'] or Decimal('0')
