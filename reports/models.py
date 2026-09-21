"""
REPORTS APP — Models

Defines the FinancialReport and ReportLineItem entities.

From the design document, Patrick's system must produce three kinds
of financial reports:
  - Valuation report: current valuations of every asset
  - Depreciation report: depreciation expense over a chosen period
  - NBV (Net Book Value) summary: closing book value per asset

Reports are SNAPSHOTS — once generated, the line items capture the
numbers AT THE TIME of generation. Even if an asset is later deleted,
the historical line item still shows its asset code and name.

Relationships:
  - One FinancialReport → many ReportLineItem rows (one per asset)
  - One Asset → many ReportLineItem rows (across many reports)
"""

import uuid
from decimal import Decimal
from django.db import models
from django.conf import settings
from assets.models import Asset


# FINANCIAL REPORT MODEL — header / metadata for a generated report
class FinancialReport(models.Model):
    """
    A single generated financial report covering a date range.
    The actual per-asset numbers live in the related ReportLineItem rows.
    """

    # Report Type Choices
    # The three report types the design document requires
    TYPE_VALUATION = 'valuation'
    TYPE_DEPRECIATION = 'depreciation'
    TYPE_NBV_SUMMARY = 'nbv_summary'

    TYPE_CHOICES = [
        (TYPE_VALUATION, 'Valuation Report'),
        (TYPE_DEPRECIATION, 'Depreciation Report'),
        (TYPE_NBV_SUMMARY, 'Net Book Value Summary'),
    ]

    # Report Status Choices
    # Draft = not yet populated; Generated = line items created; Finalized = locked for audit
    STATUS_DRAFT = 'draft'
    STATUS_GENERATED = 'generated'
    STATUS_FINALIZED = 'finalized'

    STATUS_CHOICES = [
        (STATUS_DRAFT, 'Draft'),
        (STATUS_GENERATED, 'Generated'),
        (STATUS_FINALIZED, 'Finalized'),
    ]

    # Fields
    # UUID primary key for security
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Human-readable title (e.g. "Q1 2026 Depreciation Report")
    title = models.CharField(max_length=200)

    # Type of report (drives which numbers are pulled when generating)
    report_type = models.CharField(max_length=20, choices=TYPE_CHOICES)

    # Period covered by the report
    period_start = models.DateField()
    period_end = models.DateField()

    # Current lifecycle status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)

    # Optional notes / executive summary
    notes = models.TextField(blank=True)

    # Aggregate totals — computed once at generation time and cached on the report
    # so dashboards and exports don't need to re-aggregate every time
    total_assets = models.PositiveIntegerField(default=0)
    total_value = models.DecimalField(
        max_digits=18, decimal_places=2, default=Decimal('0.00')
    )
    total_accumulated_depreciation = models.DecimalField(
        max_digits=18, decimal_places=2, default=Decimal('0.00')
    )
    total_nbv = models.DecimalField(
        max_digits=18, decimal_places=2, default=Decimal('0.00')
    )

    # Tracking Fields
    # Who generated this report (link to User model)
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='reports_generated'
    )

    # Timestamps for auditing
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']  # Newest first
        verbose_name = 'Financial Report'
        verbose_name_plural = 'Financial Reports'

    def __str__(self):
        return f"{self.title} ({self.get_report_type_display()})"

    # Helper Methods
    def line_item_count(self):
        """Returns the number of line items currently on this report."""
        return self.line_items.count()


# REPORT LINE ITEM MODEL — one row per asset within a report
class ReportLineItem(models.Model):
    """
    Per-asset numbers for one report.

    Snapshot pattern: asset_code and asset_name are duplicated here so
    that even if the asset is later deleted, the historical report still
    reads correctly.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # The report this line belongs to
    # CASCADE: deleting the report deletes all its line items
    report = models.ForeignKey(
        FinancialReport,
        on_delete=models.CASCADE,
        related_name='line_items'
    )

    # Link to the underlying asset (nullable — preserves history if asset deleted)
    # SET_NULL: keeps the report intact even if the asset is removed later
    asset = models.ForeignKey(
        Asset,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='report_line_items'
    )

    # Snapshot of the asset's identifying info (preserved if the asset is deleted)
    asset_code = models.CharField(max_length=50)
    asset_name = models.CharField(max_length=200)
    asset_category = models.CharField(max_length=30, blank=True)

    # Financial figures captured at report generation time
    # value_at_period: asset's value at the period (acquisition cost or latest valuation)
    value_at_period = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00')
    )

    # depreciation_for_period: expense recognized during this report's period
    depreciation_for_period = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00')
    )

    # accumulated_depreciation: total taken from acquisition through end of period
    accumulated_depreciation = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00')
    )

    # net_book_value: value_at_period − accumulated_depreciation
    net_book_value = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00')
    )

    # Timestamp
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['report', 'asset_code']  # Group by report, then alphabetical by asset code
        verbose_name = 'Report Line Item'
        verbose_name_plural = 'Report Line Items'

    def __str__(self):
        return f"{self.report.title} — {self.asset_code}"
