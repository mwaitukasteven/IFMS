"""
ASSETS APP — Models

Defines the Asset, AssetValuation, and AssetEvent entities from the
design document.

From the design:
  - Asset: central entity storing organizational assets (name, category,
    acquisition date, purchase cost, useful life, residual value, status)
  - AssetValuation: stores valuation records over time (market value,
    fair value, valuation method, valuation date)
  - AssetEvent: tracks lifecycle events (acquisition, maintenance,
    upgrade, transfer, disposal, impairment)

Relationships:
  - One User can register many Assets
  - One Asset can have many Valuation Records
  - One Asset can have many Lifecycle Events
"""

import uuid
from django.db import models
from django.conf import settings


# ASSET MODEL — central entity for all organizational assets
class Asset(models.Model):
    """
    Represents a single fixed asset (e.g. building, vehicle, equipment).
    This is the central entity of Patrick's system.
    """

    # Asset Category Choices
    # Predefined categories for consistent classification
    CATEGORY_LAND = 'land'
    CATEGORY_BUILDING = 'building'
    CATEGORY_VEHICLE = 'vehicle'
    CATEGORY_EQUIPMENT = 'equipment'
    CATEGORY_FURNITURE = 'furniture'
    CATEGORY_IT_EQUIPMENT = 'it_equipment'
    CATEGORY_MACHINERY = 'machinery'
    CATEGORY_OTHER = 'other'

    CATEGORY_CHOICES = [
        (CATEGORY_LAND, 'Land'),
        (CATEGORY_BUILDING, 'Building'),
        (CATEGORY_VEHICLE, 'Vehicle'),
        (CATEGORY_EQUIPMENT, 'Equipment'),
        (CATEGORY_FURNITURE, 'Furniture'),
        (CATEGORY_IT_EQUIPMENT, 'IT Equipment'),
        (CATEGORY_MACHINERY, 'Machinery'),
        (CATEGORY_OTHER, 'Other'),
    ]

    # Asset Status Choices
    STATUS_ACTIVE = 'active'
    STATUS_MAINTENANCE = 'under_maintenance'
    STATUS_DISPOSED = 'disposed'
    STATUS_TRANSFERRED = 'transferred'
    STATUS_IMPAIRED = 'impaired'

    STATUS_CHOICES = [
        (STATUS_ACTIVE, 'Active'),
        (STATUS_MAINTENANCE, 'Under Maintenance'),
        (STATUS_DISPOSED, 'Disposed'),
        (STATUS_TRANSFERRED, 'Transferred'),
        (STATUS_IMPAIRED, 'Impaired'),
    ]

    # Valuation Method Choices
    # The three internationally recognized valuation methods
    METHOD_COST = 'cost'
    METHOD_MARKET = 'market'
    METHOD_REPLACEMENT = 'replacement'

    VALUATION_METHOD_CHOICES = [
        (METHOD_COST, 'Cost Method'),
        (METHOD_MARKET, 'Market Method'),
        (METHOD_REPLACEMENT, 'Replacement Cost Method'),
    ]

    # Fields
    # UUID primary key for security
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Unique asset code for tracking (e.g. ASSET-2026-0001).
    # Auto-generated in save() when blank so the frontend never has to supply
    # it — keeps codes consistent and prevents collisions from user typos.
    asset_code = models.CharField(max_length=50, unique=True, blank=True)

    # Descriptive name (e.g. "Toyota Land Cruiser 2020")
    name = models.CharField(max_length=200)

    # Optional detailed description
    description = models.TextField(blank=True)

    # Category from predefined list
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)

    # Where the asset is physically located
    location = models.CharField(max_length=200, blank=True)

    # When the asset was acquired
    acquisition_date = models.DateField()

    # Original purchase cost (decimal for currency accuracy)
    # max_digits=15 allows up to 999,999,999,999.99 (12 digits + 2 decimal)
    acquisition_cost = models.DecimalField(max_digits=15, decimal_places=2)

    # Expected useful life in years (e.g. 5.0, 10.5)
    useful_life_years = models.DecimalField(max_digits=5, decimal_places=1, default=5.0)

    # Estimated value at end of useful life
    residual_value = models.DecimalField(
        max_digits=15, decimal_places=2, default=0.00
    )

    # Default valuation method for this asset
    valuation_method = models.CharField(
        max_length=20,
        choices=VALUATION_METHOD_CHOICES,
        default=METHOD_COST
    )

    # Current status of the asset
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_ACTIVE
    )

    # Optional image of the asset
    image = models.ImageField(upload_to='assets/', blank=True, null=True)

    # Tracking Fields
    # Who registered this asset (link to User model)
    # If user is deleted, keep asset but set creator to NULL
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='registered_assets'
    )

    # Timestamps for auditing
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']  # Newest first
        verbose_name = 'Asset'
        verbose_name_plural = 'Assets'

    def __str__(self):
        return f"{self.asset_code} - {self.name}"

    def save(self, *args, **kwargs):
        # Auto-generate ASSET-YYYY-NNNN codes when none was supplied.
        # We scope the sequence by year so the number resets each January and
        # stays readable (4 digits is plenty for a dissertation-scale system).
        if not self.asset_code:
            from django.utils import timezone
            year = timezone.now().year
            prefix = f"ASSET-{year}-"
            last = (
                Asset.objects.filter(asset_code__startswith=prefix)
                .order_by('-asset_code')
                .first()
            )
            next_num = 1
            if last:
                try:
                    next_num = int(last.asset_code.rsplit('-', 1)[-1]) + 1
                except ValueError:
                    next_num = 1
            self.asset_code = f"{prefix}{next_num:04d}"
        super().save(*args, **kwargs)

    # Helper Methods
    def get_latest_valuation(self):
        """Returns the most recent valuation record for this asset."""
        return self.valuations.order_by('-valuation_date').first()

    def get_latest_event(self):
        """Returns the most recent lifecycle event for this asset."""
        return self.events.order_by('-event_date').first()


# ASSET VALUATION MODEL — historical valuation records
class AssetValuation(models.Model):
    """
    Stores periodic valuation records for assets.
    Organizations may revalue assets over time based on market conditions.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Which asset this valuation belongs to
    # CASCADE: if the asset is deleted, delete its valuations too
    asset = models.ForeignKey(
        Asset,
        on_delete=models.CASCADE,
        related_name='valuations'  # Lets us do asset.valuations.all()
    )

    # When the valuation was performed
    valuation_date = models.DateField()

    # Current market value at the valuation date
    market_value = models.DecimalField(max_digits=15, decimal_places=2)

    # Fair value (may differ from market value)
    fair_value = models.DecimalField(max_digits=15, decimal_places=2)

    # Method used for this specific valuation
    method = models.CharField(
        max_length=20,
        choices=Asset.VALUATION_METHOD_CHOICES,
        default=Asset.METHOD_COST
    )

    # Optional notes about the valuation (basis, assumptions, etc.)
    notes = models.TextField(blank=True)

    # Who performed the valuation
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='valuations_performed'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-valuation_date']
        verbose_name = 'Asset Valuation'
        verbose_name_plural = 'Asset Valuations'

    def __str__(self):
        return f"{self.asset.asset_code} valuation on {self.valuation_date}"


# ASSET EVENT MODEL — lifecycle event tracking
class AssetEvent(models.Model):
    """
    Tracks lifecycle events on an asset:
    acquisition, maintenance, upgrade, transfer, impairment, disposal.

    This provides a complete audit trail of every change to the asset.
    """

    # Event Type Choices
    EVENT_MAINTENANCE = 'maintenance'
    EVENT_UPGRADE = 'upgrade'
    EVENT_TRANSFER = 'transfer'
    EVENT_IMPAIRMENT = 'impairment'
    EVENT_REVALUATION = 'revaluation'
    EVENT_DISPOSAL = 'disposal'

    EVENT_TYPE_CHOICES = [
        (EVENT_MAINTENANCE, 'Maintenance'),
        (EVENT_UPGRADE, 'Upgrade / Improvement'),
        (EVENT_TRANSFER, 'Transfer'),
        (EVENT_IMPAIRMENT, 'Impairment'),
        (EVENT_REVALUATION, 'Revaluation'),
        (EVENT_DISPOSAL, 'Disposal'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Which asset this event relates to
    asset = models.ForeignKey(
        Asset,
        on_delete=models.CASCADE,
        related_name='events'
    )

    # Type of event
    event_type = models.CharField(max_length=20, choices=EVENT_TYPE_CHOICES)

    # When the event occurred
    event_date = models.DateField()

    # Financial amount associated with the event (cost of maintenance,
    # upgrade cost, disposal proceeds, impairment amount, etc.)
    amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=0.00
    )

    # Detailed description of what happened
    description = models.TextField()

    # Who recorded the event
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='asset_events_recorded'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-event_date']
        verbose_name = 'Asset Event'
        verbose_name_plural = 'Asset Events'

    def __str__(self):
        return f"{self.asset.asset_code} - {self.get_event_type_display()} on {self.event_date}"