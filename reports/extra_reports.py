"""
REPORTS APP — Cross-module reports (JSON + PDF + CSV)

All endpoints accept `?export=pdf` or `?export=csv` to return a
downloadable file instead of JSON. Without the flag the response is JSON
so the React frontend can render a table view.

We use `export=` rather than `format=` because DRF's content negotiation
intercepts `format=` and would 404 for pdf/csv (no matching renderer).

  GET /api/reports/lease-report/?year=YYYY[&export=pdf|csv]
  GET /api/reports/revenue-report/?year=YYYY[&export=pdf|csv]
  GET /api/reports/budget-report/?year=YYYY[&export=pdf|csv]
  GET /api/reports/asset-report/[?export=pdf|csv]
  GET /api/reports/overall-report/?year=YYYY[&export=pdf|csv]
"""

import csv
from decimal import Decimal
from io import BytesIO, StringIO

from django.db.models import Q, Sum, Count
from django.http import HttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

from users.permissions import IsAdminOrFinanceOfficer, IsAdminOrLeaseOrFinance


# PDF HELPERS

def _build_pdf(title, meta_text, header_row, rows, summary_rows=None):
    """Render a titled table into a PDF and return bytes."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=1.5 * cm, rightMargin=1.5 * cm,
        topMargin=1.5 * cm, bottomMargin=1.5 * cm,
    )
    styles = getSampleStyleSheet()
    elements = [
        Paragraph(f"<b>{title}</b>", styles['Title']),
        Spacer(1, 6),
    ]
    if meta_text:
        elements.append(Paragraph(meta_text, styles['Normal']))
        elements.append(Spacer(1, 12))

    if summary_rows:
        summary = Table(summary_rows, hAlign='LEFT')
        summary.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(summary)
        elements.append(Spacer(1, 14))

    data = [header_row] + list(rows)
    table = Table(data, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c3e50')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.25, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
    ]))
    elements.append(table)

    doc.build(elements)
    pdf = buffer.getvalue()
    buffer.close()
    return pdf


def _pdf_response(filename, pdf_bytes):
    response = HttpResponse(pdf_bytes, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


def _csv_response(filename, header_row, rows, meta_lines=None):
    """Render a CSV download with optional header metadata rows."""
    buf = StringIO()
    writer = csv.writer(buf)
    for line in (meta_lines or []):
        writer.writerow([line])
    if meta_lines:
        writer.writerow([])
    writer.writerow(header_row)
    for r in rows:
        writer.writerow(r)
    response = HttpResponse(buf.getvalue(), content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


def _export_format(request):
    """
    Return 'pdf', 'csv', or None.

    Accepts both `?export=` (preferred) and legacy `?format=` for backward
    compatibility. Only recognises pdf/csv — anything else is treated as no
    export requested so DRF renders JSON normally.
    """
    raw = (request.query_params.get('export')
           or request.query_params.get('format')
           or '').lower()
    return raw if raw in ('pdf', 'csv') else None


def _money(v):
    try:
        return f"{Decimal(str(v or 0)):,.2f}"
    except Exception:
        return str(v or 0)


# LEASE REPORT

class LeaseReportView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrLeaseOrFinance]

    def _load(self, year):
        from leases.models import LeaseAgreement
        from leases.serializers import calculate_lease_total_rent

        leases_qs = LeaseAgreement.objects.select_related('tenant', 'property', 'unit').all()
        if year:
            leases_qs = leases_qs.filter(
                start_date__year__lte=int(year),
                end_date__year__gte=int(year),
            )

        rows = []
        for l in leases_qs:
            total = calculate_lease_total_rent(l)
            rows.append({
                'id': l.id,
                'lease_number': l.lease_number or f'LSA-{l.id}',
                'tenant_name': l.tenant.full_name,
                'property_name': l.property.name,
                'property_code': l.property.asset_code,
                'unit': l.unit_description or (l.unit.unit_number if l.unit else 'Whole property'),
                'start_date': str(l.start_date),
                'end_date': str(l.end_date),
                'monthly_rent': str(l.monthly_rent),
                'total_rent': str(total),
                'status': l.status,
            })
        return rows

    def get(self, request):
        year = request.query_params.get('year')
        rows = self._load(year)
        active = sum(1 for r in rows if r['status'] == 'active')
        header = ['Contract', 'Tenant', 'Property', 'Unit',
                  'Period', 'Monthly Rent', 'Total Rent', 'Status']
        table_rows = [
            [
                r['lease_number'], r['tenant_name'], r['property_name'], r['unit'],
                f"{r['start_date']} - {r['end_date']}",
                _money(r['monthly_rent']), _money(r['total_rent']),
                r['status'].upper(),
            ]
            for r in rows
        ]
        title = f'Lease Report{" - " + str(year) if year else ""}'
        meta = f'Total leases: {len(rows)} - Active: {active}'

        export = _export_format(request)
        if export == 'pdf':
            pdf = _build_pdf(title=title, meta_text=meta, header_row=header, rows=table_rows)
            return _pdf_response(f'lease_report_{year or "all"}.pdf', pdf)
        if export == 'csv':
            return _csv_response(
                f'lease_report_{year or "all"}.csv',
                header, table_rows,
                meta_lines=[title, meta],
            )

        return Response({
            'report_type': 'lease_report',
            'year': year,
            'total_leases': len(rows),
            'active_leases': active,
            'leases': rows,
        })


# REVENUE REPORT

class RevenueReportView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrFinanceOfficer]

    def _load(self, year):
        from payments.models import Payment
        from budgets.services import get_revenue_for_year

        payments = Payment.objects.select_related('invoice')
        if year:
            payments = payments.filter(payment_date__year=int(year))

        rows = [
            {
                'id': p.id,
                'payment_date': str(p.payment_date),
                'amount_paid': str(p.amount_paid),
                'payment_method': p.payment_method,
                'reference_number': p.reference_number,
                'invoice_number': p.invoice.invoice_number if p.invoice_id else '—',
            }
            for p in payments[:500]
        ]
        return rows, str(get_revenue_for_year(year)), payments.count()

    def get(self, request):
        year = request.query_params.get('year')
        rows, total_revenue, count = self._load(year)
        header = ['Date', 'Amount', 'Method', 'Reference', 'Invoice']
        table_rows = [
            [r['payment_date'], _money(r['amount_paid']), r['payment_method'],
             r['reference_number'], r['invoice_number']]
            for r in rows
        ]
        title = f'Revenue Report{" - " + str(year) if year else ""}'
        meta = f'Total revenue: {_money(total_revenue)} - Payments: {count}'

        export = _export_format(request)
        if export == 'pdf':
            pdf = _build_pdf(title=title, meta_text=meta, header_row=header, rows=table_rows)
            return _pdf_response(f'revenue_report_{year or "all"}.pdf', pdf)
        if export == 'csv':
            return _csv_response(
                f'revenue_report_{year or "all"}.csv',
                header, table_rows,
                meta_lines=[title, meta],
            )

        return Response({
            'report_type': 'revenue_report',
            'year': year,
            'total_revenue': total_revenue,
            'payment_count': count,
            'payments': rows,
        })


# BUDGET REPORT

class BudgetReportView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrFinanceOfficer]

    def _load(self, year):
        from budgets.models import Budget, BudgetLine
        from budgets.serializers import BudgetSerializer
        from budgets.services import get_revenue_for_year

        budgets = Budget.objects.prefetch_related('budgetline_set__linked_property').all()
        if year:
            budgets = budgets.filter(year=int(year))

        line_qs = BudgetLine.objects.filter(budget__in=budgets)
        agg = line_qs.aggregate(
            total_allocated=Sum('allocated_amount'),
            total_spent=Sum('spent_amount'),
            opex_spent=Sum('spent_amount', filter=Q(category='opex')),
            capex_spent=Sum('spent_amount', filter=Q(category='capex')),
        )
        return {
            'total_revenue': str(get_revenue_for_year(year)),
            'total_allocated': str(agg['total_allocated'] or 0),
            'total_spent': str(agg['total_spent'] or 0),
            'opex_spent': str(agg['opex_spent'] or 0),
            'capex_spent': str(agg['capex_spent'] or 0),
            'budgets': BudgetSerializer(budgets, many=True).data,
        }

    def get(self, request):
        year = request.query_params.get('year')
        data = self._load(year)
        header = ['Year', 'Total', 'Allocated', 'Spent', 'Remaining']
        table_rows = [
            [b['year'], _money(b['total_budget']), _money(b['total_allocated']),
             _money(b['total_spent']), _money(b['remaining_budget'])]
            for b in data['budgets']
        ]
        title = f'Budget Report{" - " + str(year) if year else ""}'
        meta = (
            f'Revenue: {_money(data["total_revenue"])} - '
            f'Allocated: {_money(data["total_allocated"])} - '
            f'Spent: {_money(data["total_spent"])} - '
            f'OPEX Spent: {_money(data["opex_spent"])} - '
            f'CAPEX Spent: {_money(data["capex_spent"])}'
        )

        export = _export_format(request)
        if export == 'pdf':
            pdf = _build_pdf(title=title, meta_text=meta, header_row=header, rows=table_rows)
            return _pdf_response(f'budget_report_{year or "all"}.pdf', pdf)
        if export == 'csv':
            return _csv_response(
                f'budget_report_{year or "all"}.csv',
                header, table_rows,
                meta_lines=[title, meta],
            )

        return Response({'report_type': 'budget_report', 'year': year, **data})


# ASSET REPORT — valuation + depreciation + lifecycle

class AssetReportView(APIView):
    """
    Combined asset report for the Finance Officer:
    - latest valuation per asset
    - depreciation policy summary (method, accumulated depreciation)
    - lifecycle events (most recent first)
    """

    permission_classes = [IsAuthenticated, IsAdminOrFinanceOfficer]

    def _load(self):
        from assets.models import Asset
        from depreciation.models import DepreciationSchedule

        rows = []
        for a in Asset.objects.all().prefetch_related(
            'valuations', 'events', 'depreciation_policies'
        ):
            latest_val = a.valuations.order_by('-valuation_date').first()
            latest_ev = a.events.order_by('-event_date').first()
            policy = a.depreciation_policies.first()

            accumulated = Decimal('0.00')
            closing_nbv = a.acquisition_cost
            method = '—'
            if policy:
                latest_row = (
                    DepreciationSchedule.objects
                    .filter(policy=policy)
                    .order_by('-period_year')
                    .first()
                )
                if latest_row:
                    accumulated = latest_row.accumulated_depreciation
                    closing_nbv = latest_row.closing_nbv
                method = policy.method if hasattr(policy, 'method') else '—'

            rows.append({
                'id': str(a.id),
                'asset_code': a.asset_code,
                'name': a.name,
                'category': a.category,
                'status': a.status,
                'acquisition_date': str(a.acquisition_date),
                'acquisition_cost': str(a.acquisition_cost),
                'latest_valuation_date': str(latest_val.valuation_date) if latest_val else '—',
                'latest_market_value': str(latest_val.market_value) if latest_val else '—',
                'valuation_method': latest_val.method if latest_val else '—',
                'depreciation_method': method,
                'accumulated_depreciation': str(accumulated),
                'net_book_value': str(closing_nbv),
                'latest_event_type': latest_ev.event_type if latest_ev else '—',
                'latest_event_date': str(latest_ev.event_date) if latest_ev else '—',
            })
        return rows

    def get(self, request):
        rows = self._load()
        header = [
            'Code', 'Name', 'Category', 'Status',
            'Acquired', 'Cost',
            'Latest Valuation', 'Market Value',
            'Depr. Method', 'Accum. Depr.', 'NBV',
            'Last Event', 'Event Date',
        ]
        table_rows = [
            [
                r['asset_code'], r['name'], r['category'], r['status'],
                r['acquisition_date'], _money(r['acquisition_cost']),
                r['latest_valuation_date'], _money(r['latest_market_value']),
                r['depreciation_method'], _money(r['accumulated_depreciation']),
                _money(r['net_book_value']),
                r['latest_event_type'], r['latest_event_date'],
            ]
            for r in rows
        ]
        title = 'Asset Report - Valuation, Depreciation & Lifecycle'
        meta = f'Assets: {len(rows)}'

        export = _export_format(request)
        if export == 'pdf':
            pdf = _build_pdf(title=title, meta_text=meta, header_row=header, rows=table_rows)
            return _pdf_response('asset_report.pdf', pdf)
        if export == 'csv':
            return _csv_response('asset_report.csv', header, table_rows, meta_lines=[title, meta])

        return Response({
            'report_type': 'asset_report',
            'total_assets': len(rows),
            'assets': rows,
        })


# OVERALL REPORT

class OverallReportView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrLeaseOrFinance]

    def _load(self, year):
        from assets.models import Asset
        from leases.models import LeaseAgreement
        from payments.models import Payment
        from budgets.models import Budget, BudgetLine
        from budgets.services import get_revenue_for_year

        leases = LeaseAgreement.objects.all()
        if year:
            leases = leases.filter(
                start_date__year__lte=int(year),
                end_date__year__gte=int(year),
            )

        payments = Payment.objects.all()
        budgets = Budget.objects.all()
        if year:
            payments = payments.filter(payment_date__year=int(year))
            budgets = budgets.filter(year=int(year))

        line_qs = BudgetLine.objects.filter(budget__in=budgets)

        return {
            'total_assets': Asset.objects.count(),
            'building_assets': Asset.objects.filter(category=Asset.CATEGORY_BUILDING).count(),
            'total_revenue': str(get_revenue_for_year(year)),
            'total_leases': leases.count(),
            'active_leases': leases.filter(status='active').count(),
            'total_budget': str(budgets.aggregate(t=Sum('total_budget'))['t'] or 0),
            'total_allocated': str(line_qs.aggregate(t=Sum('allocated_amount'))['t'] or 0),
            'total_spent': str(line_qs.aggregate(t=Sum('spent_amount'))['t'] or 0),
            'opex_spent': str(line_qs.filter(category='opex').aggregate(t=Sum('spent_amount'))['t'] or 0),
            'capex_spent': str(line_qs.filter(category='capex').aggregate(t=Sum('spent_amount'))['t'] or 0),
        }

    def get(self, request):
        year = request.query_params.get('year')
        s = self._load(year)
        header = ['Metric', 'Value']
        table_rows = [
            ['Total assets', s['total_assets']],
            ['Building assets', s['building_assets']],
            ['Total leases', s['total_leases']],
            ['Active leases', s['active_leases']],
            ['Total revenue', _money(s['total_revenue'])],
            ['Total budget', _money(s['total_budget'])],
            ['Total allocated', _money(s['total_allocated'])],
            ['Total spent', _money(s['total_spent'])],
            ['OPEX spent', _money(s['opex_spent'])],
            ['CAPEX spent', _money(s['capex_spent'])],
        ]
        title = f'Overall Financial Report{" - " + str(year) if year else ""}'
        meta = 'System-wide roll-up'

        export = _export_format(request)
        if export == 'pdf':
            pdf = _build_pdf(title=title, meta_text=meta, header_row=header, rows=table_rows)
            return _pdf_response(f'overall_report_{year or "all"}.pdf', pdf)
        if export == 'csv':
            return _csv_response(
                f'overall_report_{year or "all"}.csv',
                header, table_rows,
                meta_lines=[title, meta],
            )

        return Response({
            'report_type': 'overall_report',
            'year': year,
            'summary': s,
        })
