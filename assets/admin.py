"""
ASSETS APP — Django Admin Configuration
"""

from django.contrib import admin
from .models import Asset, AssetValuation, AssetEvent


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    """Admin configuration for the Asset model."""
    list_display = [
        'asset_code', 'name', 'category', 'status',
        'acquisition_cost', 'acquisition_date', 'created_at'
    ]
    list_filter = ['category', 'status', 'valuation_method', 'created_at']
    search_fields = ['asset_code', 'name', 'description', 'location']
    ordering = ['-created_at']
    readonly_fields = ['id', 'created_at', 'updated_at']

    fieldsets = (
        ('Basic Information', {
            'fields': ('asset_code', 'name', 'description', 'category', 'location', 'image')
        }),
        ('Financial Information', {
            'fields': (
                'acquisition_date', 'acquisition_cost',
                'useful_life_years', 'residual_value', 'valuation_method',
            )
        }),
        ('Status', {
            'fields': ('status',)
        }),
        ('Tracking', {
            'fields': ('created_by', 'id', 'created_at', 'updated_at'),
            'classes': ('collapse',),  # Collapsed by default
        }),
    )


@admin.register(AssetValuation)
class AssetValuationAdmin(admin.ModelAdmin):
    """Admin configuration for AssetValuation."""
    list_display = ['asset', 'valuation_date', 'market_value', 'fair_value', 'method']
    list_filter = ['method', 'valuation_date']
    search_fields = ['asset__asset_code', 'asset__name', 'notes']
    ordering = ['-valuation_date']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(AssetEvent)
class AssetEventAdmin(admin.ModelAdmin):
    """Admin configuration for AssetEvent."""
    list_display = ['asset', 'event_type', 'event_date', 'amount']
    list_filter = ['event_type', 'event_date']
    search_fields = ['asset__asset_code', 'asset__name', 'description']
    ordering = ['-event_date']
    readonly_fields = ['id', 'created_at', 'updated_at']