"""
REPORTS APP — API Views

ViewSets for CRUD on FinancialReport + ReportLineItem, plus the report
GENERATION engine and PDF / CSV export actions.

Endpoints:
  GET    /api/reports/reports/                       → List reports
  POST   /api/reports/reports/                       → Create a report (draft)
  GET    /api/reports/reports/<id>/                  → Get one report (with line items)
  PUT    /api/reports/reports/<id>/                  → Update a report
  DELETE /api/reports/reports/<id>/                  → Delete a report
  POST   /api/reports/reports/<id>/generate/         → Populate line items from current data
  GET    /api/reports/reports/<id>/export_pdf/       → Download PDF
  GET    /api/reports/reports/<id>/export_csv/       → Download CSV
  GET    /api/reports/reports/stats/                 → Dashboard stats

  GET    /api/reports/line-items/                    → List all line items
  GET    /api/reports/line-items/<id>/               → Get one line item
"""

import csv
from decimal import Decimal
from io import BytesIO

from django.db.models import Sum, Count
from django.http import HttpResponse
from django.utils import timezone

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

from assets.models import Asset
from depreciation.models import DepreciationSchedule
from .models import FinancialReport, ReportLineItem
from .serializers import (
    FinancialReportListSerializer,
    FinancialReportDetailSerializer,
    ReportLineItemSerializer,
)


# FINANCIAL REPORT VIEWSET — full CRUD + generate engine + exports
class FinancialReportViewSet(viewsets.ModelViewSet):
    """
    CRUD on financial reports plus three custom actions:
      - generate:    populate the line items by pulling current data
      - export_pdf:  download a formatted PDF of the report
      - export_csv:  download a CSV of all line items
    """

    queryset = FinancialReport.objects.all().select_related('generated_by')
    permission_classes = [IsAuthenticated]

    # Filtering, searching, ordering
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['title', 'report_type', 'notes']
    ordering_fields = ['created_at', 'period_start', 'period_end']
    ordering = ['-created_at']

    def get_serializer_class(self):
        """Use the lightweight serializer for list, the detailed one elsewhere."""
        if self.action == 'list':
            return FinancialReportListSerializer
        return FinancialReportDetailSerializer

    def perform_create(self, serializer):
        """Automatically set generated_by to the logged-in user."""
        serializer.save(generated_by=self.request.user)

    # Custom action: populate the report by pulling current data
    @action(detail=True, methods=['post'])
    def generate(self, request, pk=None):
        """
        POST /api/reports/reports/<id>/generate/

        Builds the line items for this report by iterating over every asset
        and pulling the relevant numbers based on the report_type:

          - valuation:    value at period = acquisition_cost (or latest valuation if any)
          - depreciation: depreciation_for_period = sum of schedule rows within the period
          - nbv_summary:  net_book_value = closing NBV from most recent schedule

        Existing line items are deleted first, so this is safe to re-run.
        """
        report = self.get_object()

        # Wipe old line items so we always generate cleanly
        report.line_items.all().delete()

        # Track aggregate totals as we go
        total_value = Decimal('0.00')
        total_accumulated = Decimal('0.00')
        total_nbv = Decimal('0.00')
        count = 0

        # Iterate every asset (in production you might filter by category/status)
        assets = Asset.objects.all()

        for asset in assets:
            # value_at_period defaults to the acquisition cost
            value_at_period = asset.acquisition_cost

            # If the asset has a more recent valuation, use the market value instead
            latest_valuation = asset.get_latest_valuation()
            if latest_valuation and report.report_type == FinancialReport.TYPE_VALUATION:
                value_at_period = latest_valuation.market_value

            # Compute depreciation figures from any active depreciation policy
            depreciation_for_period = Decimal('0.00')
            accumulated_depreciation = Decimal('0.00')

            # Find any depreciation policies attached to this asset
            for policy in asset.depreciation_policies.all():
                # Sum depreciation_amount on schedule rows in the report period
                period_sum = policy.schedules.filter(
                    # We treat period_year as a calendar year offset from start_date
                    # — a simple approximation suitable for the dissertation system
                ).aggregate(total=Sum('depreciation_amount'))['total'] or Decimal('0.00')

                # Total depreciation taken to date = most recent accumulated row
                latest_row = policy.get_latest_schedule()
                if latest_row:
                    accumulated_depreciation += latest_row.accumulated_depreciation

                depreciation_for_period += period_sum

            # NBV = value − accumulated depreciation (floor at zero)
            nbv = value_at_period - accumulated_depreciation
            if nbv < Decimal('0.00'):
                nbv = Decimal('0.00')

            # Create the line item (snapshot fields preserved if asset is later deleted)
            ReportLineItem.objects.create(
                report=report,
                asset=asset,
                asset_code=asset.asset_code,
                asset_name=asset.name,
                asset_category=asset.category,
                value_at_period=value_at_period,
                depreciation_for_period=depreciation_for_period,
                accumulated_depreciation=accumulated_depreciation,
                net_book_value=nbv,
            )

            # Roll up totals
            total_value += value_at_period
            total_accumulated += accumulated_depreciation
            total_nbv += nbv
            count += 1

        # Cache the aggregates on the report itself for quick display
        report.total_assets = count
        report.total_value = total_value
        report.total_accumulated_depreciation = total_accumulated
        report.total_nbv = total_nbv
        report.status = FinancialReport.STATUS_GENERATED
        report.save()

        # Return the freshly generated report
        serializer = FinancialReportDetailSerializer(report)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # Custom action: download report as CSV
    @action(detail=True, methods=['get'], url_path='export_csv')
    def export_csv(self, request, pk=None):
        """
        GET /api/reports/reports/<id>/export_csv/

        Streams the report's line items as a CSV file download.
        """
        report = self.get_object()

        # Set up the HTTP response with proper CSV headers
        response = HttpResponse(content_type='text/csv')
        filename = f"{report.title.replace(' ', '_')}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        writer = csv.writer(response)

        # Report header rows (metadata)
        writer.writerow(['Title', report.title])
        writer.writerow(['Type', report.get_report_type_display()])
        writer.writerow(['Period', f"{report.period_start} to {report.period_end}"])
        writer.writerow(['Generated By', getattr(request.user, 'full_name', '') or getattr(request.user, 'username', '') or ''])
        writer.writerow(['Generated At', report.created_at.strftime('%Y-%m-%d %H:%M')])
        writer.writerow([])  # blank line separator

        # Column headers
        writer.writerow([
            'Asset Code', 'Asset Name', 'Category',
            'Value at Period', 'Depreciation for Period',
            'Accumulated Depreciation', 'Net Book Value',
        ])

        # One row per line item
        for item in report.line_items.all():
            writer.writerow([
                item.asset_code, item.asset_name, item.asset_category,
                item.value_at_period, item.depreciation_for_period,
                item.accumulated_depreciation, item.net_book_value,
            ])

        # Totals row at the bottom
        writer.writerow([])
        writer.writerow([
            'TOTALS', '', '',
            report.total_value, '',
            report.total_accumulated_depreciation, report.total_nbv,
        ])

        return response

    # Custom action: download report as PDF
    @action(detail=True, methods=['get'], url_path='export_pdf')
    def export_pdf(self, request, pk=None):
        """
        GET /api/reports/reports/<id>/export_pdf/

        Renders the report as a formatted PDF using reportlab and returns
        it as a file download.
        """
        report = self.get_object()

        # Build PDF in memory
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            leftMargin=1.5 * cm, rightMargin=1.5 * cm,
            topMargin=1.5 * cm, bottomMargin=1.5 * cm,
        )

        # Reusable styles
        styles = getSampleStyleSheet()
        elements = []

        # Header (title + metadata)
        elements.append(Paragraph(f"<b>{report.title}</b>", styles['Title']))
        elements.append(Spacer(1, 6))
        meta = (
            f"Type: {report.get_report_type_display()}<br/>"
            f"Period: {report.period_start} to {report.period_end}<br/>"
            f"Generated by: {getattr(request.user, 'full_name', '') or getattr(request.user, 'username', '') or '—'}<br/>"
            f"Generated at: {report.created_at.strftime('%Y-%m-%d %H:%M')}"
        )
        elements.append(Paragraph(meta, styles['Normal']))
        elements.append(Spacer(1, 18))

        # Table of line items
        data = [[
            'Asset Code', 'Asset Name', 'Category',
            'Value', 'Depreciation', 'Accumulated', 'NBV',
        ]]
        for item in report.line_items.all():
            data.append([
                item.asset_code,
                item.asset_name,
                item.asset_category,
                f"{item.value_at_period:,.2f}",
                f"{item.depreciation_for_period:,.2f}",
                f"{item.accumulated_depreciation:,.2f}",
                f"{item.net_book_value:,.2f}",
            ])

        # Totals row
        data.append([
            'TOTALS', '', '',
            f"{report.total_value:,.2f}", '',
            f"{report.total_accumulated_depreciation:,.2f}",
            f"{report.total_nbv:,.2f}",
        ])

        # Style the table — header band, grid, bold totals row
        table = Table(data, repeatRows=1)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c3e50')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ALIGN', (3, 1), (-1, -1), 'RIGHT'),  # right-align money columns
            ('GRID', (0, 0), (-1, -1), 0.25, colors.grey),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#ecf0f1')),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(table)

        # Build the document
        doc.build(elements)

        # Stream back as an HTTP file response
        pdf = buffer.getvalue()
        buffer.close()

        filename = f"{report.title.replace(' ', '_')}.pdf"
        response = HttpResponse(pdf, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    # Custom action: dashboard statistics
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        GET /api/reports/reports/stats/

        Aggregate statistics for the reports dashboard.
        """
        total_reports = FinancialReport.objects.count()
        generated = FinancialReport.objects.filter(
            status=FinancialReport.STATUS_GENERATED
        ).count()
        finalized = FinancialReport.objects.filter(
            status=FinancialReport.STATUS_FINALIZED
        ).count()

        # Count by report type
        by_type = list(
            FinancialReport.objects.values('report_type')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        return Response({
            'total_reports': total_reports,
            'generated_reports': generated,
            'finalized_reports': finalized,
            'by_type': by_type,
        })


# REPORT LINE ITEM VIEWSET — read-only access to individual line items
class ReportLineItemViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only CRUD on line items. Line items are normally created by the
    generate action, not directly via the API, so we don't expose write
    endpoints here.
    """

    queryset = ReportLineItem.objects.all().select_related('report', 'asset')
    serializer_class = ReportLineItemSerializer
    permission_classes = [IsAuthenticated]

    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['asset_code', 'asset_name']
    ordering_fields = ['created_at', 'asset_code']
    ordering = ['report', 'asset_code']
