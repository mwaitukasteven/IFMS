"""
DEPRECIATION APP — Models

Defines the DepreciationPolicy and DepreciationSchedule entities.

From the design document:
  - DepreciationPolicy: per-asset rule that says HOW the asset will be
    depreciated (which method, useful life, residual value, accounting
    standard). One Asset can have at most one ACTIVE policy at a time.
  - DepreciationSchedule: the actual year-by-year breakdown generated
    from the policy. Each row shows the asset's value at the start of
    the period, the depreciation taken, accumulated depreciation to date,
    and the Net Book Value (NBV) at the end of the period.

Supported depreciation methods (per IAS 16 / IPSAS 17):
  - SLM (Straight Line Method): equal annual expense over useful life
  - DBM (Declining Balance Method): expense is a % of current NBV each year
  - UPM (Units of Production Method): expense based on units consumed

Relationships:
  - One Asset → one (active) DepreciationPolicy
  - One DepreciationPolicy → many DepreciationSchedule rows (one per period)
"""

import uuid
from decimal import Decimal
from django.db import models
from django.conf import settings
from assets.models import Asset


# DEPRECIATION POLICY MODEL — the rule that governs how an asset depreciates
class DepreciationPolicy(models.Model):
    """
    Represents a single depreciation rule attached to one asset.

    Patrick's system allows organizations to choose any IAS 16 / IPSAS 17
    compliant method per asset. The policy stores the method and inputs
    needed to generate a depreciation schedule.
    """

    # Depreciation Method Choices
    # The three internationally accepted methods (IAS 16 / IPSAS 17)
    METHOD_SLM = 'SLM'           # Straight-Line Method
    METHOD_DBM = 'DBM'           # Declining Balance Method
    METHOD_UPM = 'UPM'           # Units of Production Method

    METHOD_CHOICES = [
        (METHOD_SLM, 'Straight-Line Method'),
        (METHOD_DBM, 'Declining Balance Method'),
        (METHOD_UPM, 'Units of Production Method'),
    ]

    # Accounting Standard Choices
    # The two standards Patrick's system supports
    STANDARD_IFRS = 'IFRS'       # International Financial Reporting Standards (private sector)
    STANDARD_IPSAS = 'IPSAS'     # International Public Sector Accounting Standards

    STANDARD_CHOICES = [
        (STANDARD_IFRS, 'IFRS (IAS 16)'),
        (STANDARD_IPSAS, 'IPSAS 17'),
    ]

    # Policy Status Choices
    # Active = currently in use; Inactive = paused; Closed = asset fully depreciated/disposed
    STATUS_ACTIVE = 'active'
    STATUS_INACTIVE = 'inactive'
    STATUS_CLOSED = 'closed'

    STATUS_CHOICES = [
        (STATUS_ACTIVE, 'Active'),
        (STATUS_INACTIVE, 'Inactive'),
        (STATUS_CLOSED, 'Closed'),
    ]

    # Fields
    # UUID primary key for security
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # The asset this policy governs
    # CASCADE: deleting the asset deletes its depreciation policy too
    asset = models.ForeignKey(
        Asset,
        on_delete=models.CASCADE,
        related_name='depreciation_policies'  # Lets us do asset.depreciation_policies.all()
    )

    # Which depreciation method this policy uses
    method = models.CharField(max_length=10, choices=METHOD_CHOICES, default=METHOD_SLM)

    # Useful life in years (e.g. 5.0, 10.5) — copied from asset by default but
    # the user can override per-policy if accounting rules differ
    useful_life_years = models.DecimalField(max_digits=5, decimal_places=1)

    # Estimated salvage / residual value at end of useful life
    residual_value = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    # Depreciation rate as a percentage (used by DBM only, e.g. 20.00 for 20%)
    # Nullable because SLM and UPM don't use a rate
    depreciation_rate = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text='Required for Declining Balance Method (e.g. 20.00 for 20%)'
    )

    # Total expected output units (used by UPM only — e.g. 100000 km for a vehicle)
    total_units = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Required for Units of Production Method (total expected lifetime output)'
    )

    # Accounting standard this policy follows
    standard = models.CharField(max_length=10, choices=STANDARD_CHOICES, default=STANDARD_IFRS)

    # Date depreciation begins (usually the acquisition date)
    start_date = models.DateField()

    # Current status of the policy
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)

    # Optional notes / justification for the chosen method
    notes = models.TextField(blank=True)

    # Tracking Fields
    # Who created this policy (link to User model)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='depreciation_policies_created'
    )

    # Timestamps for auditing
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']  # Newest first
        verbose_name = 'Depreciation Policy'
        verbose_name_plural = 'Depreciation Policies'

    def __str__(self):
        return f"{self.asset.asset_code} — {self.get_method_display()}"

    # Helper Methods
    def calculate_slm_annual(self):
        """
        Straight-Line annual depreciation.
        Formula: (cost − residual) / useful_life_years
        """
        cost = self.asset.acquisition_cost
        return (cost - self.residual_value) / self.useful_life_years

    def calculate_dbm_annual(self, opening_nbv):
        """
        Declining Balance annual depreciation.
        Formula: opening_NBV × rate%
        Note: rate is stored as a percentage (e.g. 20.00), so we divide by 100.
        """
        if self.depreciation_rate is None:
            return Decimal('0.00')
        rate = self.depreciation_rate / Decimal('100')
        return opening_nbv * rate

    def calculate_upm_amount(self, units_used):
        """
        Units of Production depreciation for a single period.
        Formula: (cost − residual) / total_units × units_used
        """
        if not self.total_units or self.total_units == 0:
            return Decimal('0.00')
        cost = self.asset.acquisition_cost
        per_unit = (cost - self.residual_value) / Decimal(self.total_units)
        return per_unit * Decimal(units_used)

    def get_latest_schedule(self):
        """Returns the most recent schedule row, or None if none generated yet."""
        return self.schedules.order_by('-period_year').first()


# DEPRECIATION SCHEDULE MODEL — year-by-year breakdown generated from a policy
class DepreciationSchedule(models.Model):
    """
    A single period (usually a year) of a depreciation schedule.

    Generated automatically by the policy's depreciation engine, but the
    user can also create/edit rows manually (especially for UPM where
    each period needs the actual units used to be entered).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Which policy this schedule row belongs to
    # CASCADE: deleting the policy deletes its schedule rows
    policy = models.ForeignKey(
        DepreciationPolicy,
        on_delete=models.CASCADE,
        related_name='schedules'  # Lets us do policy.schedules.all()
    )

    # The accounting year this row covers (e.g. 1 = first year after start_date)
    period_year = models.PositiveIntegerField()

    # Net Book Value at the start of the period
    opening_nbv = models.DecimalField(max_digits=15, decimal_places=2)

    # Depreciation expense recognized in this period
    depreciation_amount = models.DecimalField(max_digits=15, decimal_places=2)

    # Running total of all depreciation taken from start of policy through this period
    accumulated_depreciation = models.DecimalField(max_digits=15, decimal_places=2)

    # Net Book Value at the end of the period (opening − depreciation)
    closing_nbv = models.DecimalField(max_digits=15, decimal_places=2)

    # Units consumed in this period (UPM only — null/0 for SLM and DBM)
    units_used = models.PositiveIntegerField(null=True, blank=True)

    # Optional notes (e.g. "revaluation triggered this period")
    notes = models.TextField(blank=True)

    # Timestamps for auditing
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['policy', 'period_year']  # Group by policy, in order
        verbose_name = 'Depreciation Schedule'
        verbose_name_plural = 'Depreciation Schedules'
        # A policy can only have one row per period (prevents duplicates)
        unique_together = ('policy', 'period_year')

    def __str__(self):
        return f"{self.policy.asset.asset_code} — Year {self.period_year}: NBV {self.closing_nbv}"
