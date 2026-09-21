"""
Finance-officer facing report endpoints.

Each report exposes three response formats via the `?export=` query parameter:
    - json (default) — JSON payload rendered inline in the UI
    - csv           — spreadsheet-friendly download
    - pdf           — printable download (reportlab)

Reports covered:
    - overall     : rolled-up summary + lease/asset/budget breakdowns
    - summary     : revenue vs. OPEX/CAPEX vs. per-asset breakdown
    - leases      : lease agreements with tenant and property columns
    - assets      : asset registry with lease status
    - budgets     : yearly budget plans with line-item allocations vs. spend

Note: `?export=` is used instead of `?format=` because DRF's content
negotiation intercepts `format=` and would 404 for csv/pdf.
"""

import csv
from datetime import date
from decimal import Decimal
from io import BytesIO

from django.db.models import Sum
from django.http import HttpResponse

from rest_framework.views import APIView
from rest_framework.response import Response

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
)

from users.permissions import IsAdminOrLeaseOrFinance
from assets.models import Asset
from budgets.models import Budget, BudgetLine
from budgets.services import get_revenue_for_year
from invoices.models import Invoice
from leases.models import LeaseAgreement
from payments.models import Payment


BUILDING_CATEGORY = 'building'


def _fmt_money(value):
    if value in (None, ''):
        return '0.00'
    try:
        return f"{Decimal(value):,.2f}"
    except Exception:
        return str(value)


def _slug(value):
    return ''.join(c if c.isalnum() else '_' for c in str(value)).strip('_')


def _asset_display(prop):
    """Return the display name of a lease/property foreign key that points at Asset."""
    if prop is None:
        return ''
    return getattr(prop, 'name', None) or getattr(prop, 'asset_name', '') or ''


def _csv_response(filename, header_rows, columns, rows, totals_row=None):
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{filename}.csv"'
    writer = csv.writer(response)
    for row in header_rows:
        writer.writerow(row)
    writer.writerow([])
    writer.writerow(columns)
    for row in rows:
        writer.writerow(row)
    if totals_row is not None:
        writer.writerow([])
        writer.writerow(totals_row)
    return response


def _pdf_response(filename, title, subtitle_lines, columns, rows, totals_row=None):
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=1.2 * cm,
        rightMargin=1.2 * cm,
        topMargin=1.2 * cm,
        bottomMargin=1.2 * cm,
    )
    styles = getSampleStyleSheet()
    elements = [Paragraph(f"<b>{title}</b>", styles['Title']), Spacer(1, 6)]
    for line in subtitle_lines:
        elements.append(Paragraph(line, styles['Normal']))
    elements.append(Spacer(1, 14))

    data = [columns] + [list(r) for r in rows]
    if totals_row is not None:
        data.append(list(totals_row))

    table = Table(data, repeatRows=1)
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c3e50')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.25, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]
    if totals_row is not None:
        style.append(('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#ecf0f1')))
        style.append(('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'))
    table.setStyle(TableStyle(style))
    elements.append(table)

    doc.build(elements)
    pdf = buffer.getvalue()
    buffer.close()

    response = HttpResponse(pdf, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}.pdf"'
    return response


class BaseReportView(APIView):
    permission_classes = [IsAdminOrLeaseOrFinance]

    def get(self, request):
        data = self.build(request)
        fmt = (request.query_params.get('export') or 'json').lower()

        if fmt == 'csv':
            columns = self.columns()
            rows = list(self.row_iter(data))
            totals = self.totals(data)
            filename = self.filename(data)
            header = [[line] for line in self._flatten_subtitle(self.subtitle(data))]
            header.insert(0, ['Report', self.title(data)])
            return _csv_response(filename, header, columns, rows, totals)

        if fmt == 'pdf':
            columns = self.columns()
            rows = list(self.row_iter(data))
            totals = self.totals(data)
            filename = self.filename(data)
            return _pdf_response(
                filename,
                self.title(data),
                self.subtitle(data),
                columns,
                rows,
                totals,
            )

        return Response(data)

    @staticmethod
    def _flatten_subtitle(lines):
        return [line.replace('<br/>', ' ').replace('<b>', '').replace('</b>', '') for line in lines]

    def totals(self, data):  # noqa: ARG002
        return None


class FinancialSummaryReportView(BaseReportView):
    def build(self, request):
        year = request.query_params.get('year')
        payment_qs = Payment.objects.all()
        invoice_qs = Invoice.objects.filter(status='paid')
        if year:
            payment_qs = payment_qs.filter(payment_date__year=year)
            invoice_qs = invoice_qs.filter(issue_date__year=year)

        total_received = payment_qs.aggregate(t=Sum('amount_paid'))['t'] or Decimal('0')

        budget_qs = Budget.objects.all()
        if year:
            budget_qs = budget_qs.filter(year=year)
        line_qs = BudgetLine.objects.filter(budget__in=budget_qs)

        capex = line_qs.filter(category='capex').aggregate(
            allocated=Sum('allocated_amount'), spent=Sum('spent_amount'),
        )
        opex = line_qs.filter(category='opex').aggregate(
            allocated=Sum('allocated_amount'), spent=Sum('spent_amount'),
        )

        breakdown = []
        for line in line_qs.select_related('linked_property'):
            breakdown.append({
                'asset': _asset_display(line.linked_property) or 'General',
                'asset_code': line.linked_property.asset_code if line.linked_property else '',
                'category': line.category,
                'description': line.description,
                'allocated': str(line.allocated_amount),
                'spent': str(line.spent_amount),
            })

        return {
            'year': year,
            'total_money_received': str(total_received),
            'paid_invoices_count': invoice_qs.count(),
            'capex': {
                'allocated': str(capex['allocated'] or 0),
                'spent': str(capex['spent'] or 0),
            },
            'opex': {
                'allocated': str(opex['allocated'] or 0),
                'spent': str(opex['spent'] or 0),
            },
            'asset_breakdown': breakdown,
        }

    def title(self, data):
        year = data.get('year') or 'All Years'
        return f"Financial Summary Report — {year}"

    def subtitle(self, data):
        return [
            f"Total revenue received: {_fmt_money(data['total_money_received'])}",
            f"Paid invoices: {data['paid_invoices_count']}",
            f"OPEX allocated / spent: {_fmt_money(data['opex']['allocated'])} / {_fmt_money(data['opex']['spent'])}",
            f"CAPEX allocated / spent: {_fmt_money(data['capex']['allocated'])} / {_fmt_money(data['capex']['spent'])}",
            f"Generated: {date.today().isoformat()}",
        ]

    def columns(self):
        return ['Asset', 'Asset Code', 'Category', 'Description', 'Allocated', 'Spent']

    def row_iter(self, data):
        for r in data['asset_breakdown']:
            yield [
                r['asset'], r['asset_code'], r['category'].upper(),
                r['description'], _fmt_money(r['allocated']), _fmt_money(r['spent']),
            ]

    def totals(self, data):
        allocated = sum(Decimal(r['allocated']) for r in data['asset_breakdown']) if data['asset_breakdown'] else Decimal('0')
        spent = sum(Decimal(r['spent']) for r in data['asset_breakdown']) if data['asset_breakdown'] else Decimal('0')
        return ['TOTALS', '', '', '', _fmt_money(allocated), _fmt_money(spent)]

    def filename(self, data):
        return f"financial_summary_{_slug(data.get('year') or 'all')}"


class LeaseReportView(BaseReportView):
    def build(self, request):
        year = request.query_params.get('year')
        qs = LeaseAgreement.objects.select_related('tenant', 'property', 'unit')
        if year:
            qs = qs.filter(start_date__year__lte=int(year), end_date__year__gte=int(year))

        leases = []
        for lease in qs:
            leases.append({
                'lease_number': lease.lease_number,
                'tenant': str(lease.tenant) if lease.tenant else '',
                'property': _asset_display(lease.property),
                'unit': (lease.unit.unit_number if lease.unit else '') or lease.unit_description or '',
                'start_date': lease.start_date.isoformat() if lease.start_date else '',
                'end_date': lease.end_date.isoformat() if lease.end_date else '',
                'monthly_rent': str(lease.monthly_rent),
                'status': lease.status,
            })

        active = sum(1 for l in leases if l['status'] == 'active')
        total_rent = sum(Decimal(l['monthly_rent']) for l in leases) if leases else Decimal('0')

        return {
            'year': year,
            'total_leases': len(leases),
            'active_leases': active,
            'total_monthly_rent': str(total_rent),
            'leases': leases,
        }

    def title(self, data):
        return f"Lease Report — {data.get('year') or 'All Years'}"

    def subtitle(self, data):
        return [
            f"Total leases: {data['total_leases']}",
            f"Active leases: {data['active_leases']}",
            f"Total monthly rent: {_fmt_money(data['total_monthly_rent'])}",
            f"Generated: {date.today().isoformat()}",
        ]

    def columns(self):
        return ['Lease #', 'Tenant', 'Property', 'Unit', 'Start', 'End', 'Monthly Rent', 'Status']

    def row_iter(self, data):
        for l in data['leases']:
            yield [
                l['lease_number'], l['tenant'], l['property'], l['unit'],
                l['start_date'], l['end_date'], _fmt_money(l['monthly_rent']),
                l['status'].capitalize(),
            ]

    def totals(self, data):
        return ['', '', '', '', '', 'TOTAL', _fmt_money(data['total_monthly_rent']), '']

    def filename(self, data):
        return f"lease_report_{_slug(data.get('year') or 'all')}"


class AssetReportView(BaseReportView):
    """Buildings (leaseable assets) with their current lease status."""

    def build(self, request):
        buildings = Asset.objects.filter(category=BUILDING_CATEGORY)
        active_leases = LeaseAgreement.objects.filter(
            status='active',
        ).select_related('property')
        leased_ids = set(active_leases.values_list('property_id', flat=True))

        assets = []
        for a in buildings:
            assets.append({
                'asset_code': a.asset_code,
                'asset_name': a.name,
                'category': a.get_category_display() if hasattr(a, 'get_category_display') else a.category,
                'location': a.location or '',
                'currently_leased': a.id in leased_ids,
            })

        return {
            'total_assets': len(assets),
            'leased_assets': sum(1 for a in assets if a['currently_leased']),
            'available_assets': sum(1 for a in assets if not a['currently_leased']),
            'assets': assets,
        }

    def title(self, data):
        return "Asset Report"

    def subtitle(self, data):
        return [
            f"Total assets: {data['total_assets']}",
            f"Currently leased: {data['leased_assets']}",
            f"Available for lease: {data['available_assets']}",
            f"Generated: {date.today().isoformat()}",
        ]

    def columns(self):
        return ['Asset Code', 'Asset Name', 'Category', 'Location', 'Leased?', 'Available?']

    def row_iter(self, data):
        for a in data['assets']:
            yield [
                a['asset_code'], a['asset_name'], a['category'], a['location'],
                'Yes' if a['currently_leased'] else 'No',
                'No' if a['currently_leased'] else 'Yes',
            ]

    def filename(self, data):
        return "asset_report"


class BudgetReportView(BaseReportView):
    def build(self, request):
        year = request.query_params.get('year')
        budgets = Budget.objects.prefetch_related('budgetline_set__linked_property').all()
        if year:
            budgets = budgets.filter(year=year)

        rows = []
        total_budget = Decimal('0')
        total_allocated = Decimal('0')
        total_spent = Decimal('0')
        for b in budgets:
            total_budget += b.total_budget or Decimal('0')
            for line in b.budgetline_set.all():
                rows.append({
                    'year': b.year,
                    'category': line.category,
                    'description': line.description,
                    'asset': _asset_display(line.linked_property) or 'General',
                    'allocated': str(line.allocated_amount),
                    'spent': str(line.spent_amount),
                })
                total_allocated += line.allocated_amount or Decimal('0')
                total_spent += line.spent_amount or Decimal('0')

        return {
            'year': year,
            'total_revenue': str(get_revenue_for_year(year)),
            'total_budget': str(total_budget),
            'total_allocated': str(total_allocated),
            'total_spent': str(total_spent),
            'lines': rows,
        }

    def title(self, data):
        return f"Budget Report — {data.get('year') or 'All Years'}"

    def subtitle(self, data):
        return [
            f"Total revenue: {_fmt_money(data['total_revenue'])}",
            f"Total budget planned: {_fmt_money(data['total_budget'])}",
            f"Total allocated: {_fmt_money(data['total_allocated'])}",
            f"Total spent: {_fmt_money(data['total_spent'])}",
            f"Generated: {date.today().isoformat()}",
        ]

    def columns(self):
        return ['Year', 'Category', 'Description', 'Asset', 'Allocated', 'Spent']

    def row_iter(self, data):
        for r in data['lines']:
            yield [
                r['year'], r['category'].upper(), r['description'], r['asset'],
                _fmt_money(r['allocated']), _fmt_money(r['spent']),
            ]

    def totals(self, data):
        return ['', '', '', 'TOTAL', _fmt_money(data['total_allocated']), _fmt_money(data['total_spent'])]

    def filename(self, data):
        return f"budget_report_{_slug(data.get('year') or 'all')}"


class OverallReportView(BaseReportView):
    def build(self, request):
        year = request.query_params.get('year')
        revenue = get_revenue_for_year(year)

        lease_qs = LeaseAgreement.objects.all()
        if year:
            lease_qs = lease_qs.filter(start_date__year__lte=int(year), end_date__year__gte=int(year))
        payment_qs = Payment.objects.all()
        if year:
            payment_qs = payment_qs.filter(payment_date__year=int(year))
        budget_qs = Budget.objects.all()
        if year:
            budget_qs = budget_qs.filter(year=int(year))
        line_qs = BudgetLine.objects.filter(budget__in=budget_qs)

        return {
            'year': year,
            'total_revenue': str(revenue),
            'total_payments': payment_qs.count(),
            'total_leases': lease_qs.count(),
            'active_leases': lease_qs.filter(status='active').count(),
            'total_assets': Asset.objects.filter(category=BUILDING_CATEGORY).count(),
            'total_budget': str(budget_qs.aggregate(t=Sum('total_budget'))['t'] or 0),
            'opex_allocated': str(line_qs.filter(category='opex').aggregate(t=Sum('allocated_amount'))['t'] or 0),
            'opex_spent': str(line_qs.filter(category='opex').aggregate(t=Sum('spent_amount'))['t'] or 0),
            'capex_allocated': str(line_qs.filter(category='capex').aggregate(t=Sum('allocated_amount'))['t'] or 0),
            'capex_spent': str(line_qs.filter(category='capex').aggregate(t=Sum('spent_amount'))['t'] or 0),
        }

    def title(self, data):
        return f"Overall Financial Report — {data.get('year') or 'All Years'}"

    def subtitle(self, data):
        return [f"Generated: {date.today().isoformat()}"]

    def columns(self):
        return ['Metric', 'Value']

    def row_iter(self, data):
        yield ['Total Revenue', _fmt_money(data['total_revenue'])]
        yield ['Total Payments Recorded', data['total_payments']]
        yield ['Total Leases', data['total_leases']]
        yield ['Active Leases', data['active_leases']]
        yield ['Total Assets', data['total_assets']]
        yield ['Total Budget Planned', _fmt_money(data['total_budget'])]
        yield ['OPEX Allocated', _fmt_money(data['opex_allocated'])]
        yield ['OPEX Spent', _fmt_money(data['opex_spent'])]
        yield ['CAPEX Allocated', _fmt_money(data['capex_allocated'])]
        yield ['CAPEX Spent', _fmt_money(data['capex_spent'])]

    def filename(self, data):
        return f"overall_report_{_slug(data.get('year') or 'all')}"
