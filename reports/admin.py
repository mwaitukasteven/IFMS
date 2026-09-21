"""
REPORTS APP — Django Admin Configuration

Registers FinancialReport and ReportLineItem with Django's admin panel.

The line items are shown inline on the report's edit page so admins can
review the exact numbers that ended up in the generated report.
"""

from django.contrib import admin
from .models import FinancialReport, ReportLineItem


# Inline view — line items shown directly inside the report detail page
class ReportLineItemInline(admin.TabularInline):
    """Lets admins see a report's full line item list inline on the report page."""
    model = ReportLineItem
    extra = 0  # No empty extra rows
    readonly_fields = ['id', 'created_at']
    ordering = ['asset_code']


@admin.register(FinancialReport)
class FinancialReportAdmin(admin.ModelAdmin):
    """Admin configuration for the FinancialReport model."""
    list_display = [
        'title', 'report_type', 'period_start', 'period_end',
        'status', 'total_assets', 'total_nbv', 'created_at',
    ]
    list_filter = ['report_type', 'status', 'period_start']
    search_fields = ['title', 'notes']
    ordering = ['-created_at']
    readonly_fields = [
        'id', 'total_assets', 'total_value',
        'total_accumulated_depreciation', 'total_nbv',
        'created_at', 'updated_at',
    ]

    # Show line items inline on the report edit page
    inlines = [ReportLineItemInline]

    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'report_type', 'status', 'notes'),
        }),
        ('Period', {
            'fields': ('period_start', 'period_end'),
        }),
        ('Aggregate Totals (auto-computed)', {
            'fields': (
                'total_assets', 'total_value',
                'total_accumulated_depreciation', 'total_nbv',
            ),
        }),
        ('Tracking', {
            'fields': ('generated_by', 'id', 'created_at', 'updated_at'),
            'classes': ('collapse',),  # Collapsed by default
        }),
    )


@admin.register(ReportLineItem)
class ReportLineItemAdmin(admin.ModelAdmin):
    """Admin configuration for individual line items."""
    list_display = [
        'report', 'asset_code', 'asset_name',
        'value_at_period', 'accumulated_depreciation', 'net_book_value',
    ]
    list_filter = ['report__report_type', 'asset_category']
    search_fields = ['asset_code', 'asset_name', 'report__title']
    ordering = ['report', 'asset_code']
    readonly_fields = ['id', 'created_at']
