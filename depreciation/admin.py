"""
DEPRECIATION APP — Django Admin Configuration

Registers DepreciationPolicy and DepreciationSchedule with the admin
panel so they can be managed via /admin/ in the browser.

Schedule rows are also shown inline on the policy detail page, which
makes auditing the generated schedule much easier.
"""

from django.contrib import admin
from .models import DepreciationPolicy, DepreciationSchedule


# Inline view — shows the schedule rows directly inside the policy detail page
class DepreciationScheduleInline(admin.TabularInline):
    """Lets admins see a policy's full schedule inline on the policy page."""
    model = DepreciationSchedule
    extra = 0  # Don't show empty extra rows
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['period_year']


@admin.register(DepreciationPolicy)
class DepreciationPolicyAdmin(admin.ModelAdmin):
    """Admin configuration for the DepreciationPolicy model."""
    list_display = [
        'asset', 'method', 'standard',
        'useful_life_years', 'residual_value', 'status', 'start_date',
    ]
    list_filter = ['method', 'standard', 'status', 'start_date']
    search_fields = ['asset__asset_code', 'asset__name', 'notes']
    ordering = ['-created_at']
    readonly_fields = ['id', 'created_at', 'updated_at']

    # Show the generated schedule inline on the policy edit page
    inlines = [DepreciationScheduleInline]

    fieldsets = (
        ('Asset & Method', {
            'fields': ('asset', 'method', 'standard'),
        }),
        ('Depreciation Inputs', {
            'fields': (
                'useful_life_years', 'residual_value',
                'depreciation_rate', 'total_units',
                'start_date',
            ),
        }),
        ('Status', {
            'fields': ('status', 'notes'),
        }),
        ('Tracking', {
            'fields': ('created_by', 'id', 'created_at', 'updated_at'),
            'classes': ('collapse',),  # Collapsed by default
        }),
    )


@admin.register(DepreciationSchedule)
class DepreciationScheduleAdmin(admin.ModelAdmin):
    """Admin configuration for individual schedule rows."""
    list_display = [
        'policy', 'period_year',
        'opening_nbv', 'depreciation_amount',
        'accumulated_depreciation', 'closing_nbv',
    ]
    list_filter = ['period_year']
    search_fields = ['policy__asset__asset_code', 'policy__asset__name']
    ordering = ['policy', 'period_year']
    readonly_fields = ['id', 'created_at', 'updated_at']
