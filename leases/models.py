from django.conf import settings
from django.db import models

from tenants.models import Tenant
from properties.models import PropertyUnit


class LeaseAgreement(models.Model):
    """
    A lease binds a tenant to a *building* (assets.Asset with
    category='building'), optionally down to a specific PropertyUnit.
    """

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)

    property = models.ForeignKey(
        'assets.Asset',
        on_delete=models.CASCADE,
        related_name='lease_agreements',
        limit_choices_to={'category': 'building'},
    )

    unit = models.ForeignKey(
        PropertyUnit,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    lease_manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='managed_leases',
    )

    unit_description = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text='Free-text description when no specific PropertyUnit exists.',
    )

    start_date = models.DateField()
    end_date = models.DateField()

    monthly_rent = models.DecimalField(max_digits=12, decimal_places=2)

    status = models.CharField(
        max_length=20,
        choices=(
            ('active', 'Active'),
            ('expired', 'Expired'),
            ('terminated', 'Terminated'),
        ),
        default='active',
    )

    lease_number = models.CharField(max_length=50, unique=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, null=True)

    def __str__(self):
        return self.lease_number or f'Lease #{self.pk}'
