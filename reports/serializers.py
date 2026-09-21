"""
REPORTS APP — Serializers

Converts FinancialReport and ReportLineItem models to/from JSON.

We provide:
  - ReportLineItemSerializer: individual line items
  - FinancialReportListSerializer: lightweight (used in list views)
  - FinancialReportDetailSerializer: full details with nested line items
"""

from rest_framework import serializers
from .models import FinancialReport, ReportLineItem


# REPORT LINE ITEM SERIALIZER
class ReportLineItemSerializer(serializers.ModelSerializer):
    """Serializes a single line item (one asset in a report)."""

    class Meta:
        model = ReportLineItem
        fields = [
            'id', 'report',
            'asset', 'asset_code', 'asset_name', 'asset_category',
            'value_at_period', 'depreciation_for_period',
            'accumulated_depreciation', 'net_book_value',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


# FINANCIAL REPORT LIST SERIALIZER (lightweight — for listings)
class FinancialReportListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for listing many reports.
    Excludes nested line items to keep list responses fast.
    """

    # Friendly display values
    report_type_display = serializers.CharField(source='get_report_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    # Who generated this report
    generated_by_name = serializers.CharField(
        source='generated_by.full_name', read_only=True, default=''
    )

    # Count of line items (helpful for the list page)
    line_item_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = FinancialReport
        fields = [
            'id', 'title',
            'report_type', 'report_type_display',
            'period_start', 'period_end',
            'status', 'status_display', 'notes',
            'total_assets', 'total_value',
            'total_accumulated_depreciation', 'total_nbv',
            'line_item_count',
            'generated_by', 'generated_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'generated_by',
            'total_assets', 'total_value',
            'total_accumulated_depreciation', 'total_nbv',
            'created_at', 'updated_at',
        ]


# FINANCIAL REPORT DETAIL SERIALIZER (with nested line items)
class FinancialReportDetailSerializer(FinancialReportListSerializer):
    """
    Full report details including every line item.
    Used for the report detail page (and as the source for PDF/CSV exports).
    """

    # Nested list of all line items for this report (read-only — created by engine)
    line_items = ReportLineItemSerializer(many=True, read_only=True)

    class Meta(FinancialReportListSerializer.Meta):
        fields = FinancialReportListSerializer.Meta.fields + ['line_items']
