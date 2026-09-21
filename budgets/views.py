from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from users.permissions import IsAdminOrFinanceOfficer, IsAdminOrLeaseOrFinance, IsTenant
from rest_framework.permissions import IsAuthenticated
from payments.models import Payment
from payments.serializers import PaymentSerializer
from invoices.models import Invoice
from .models import Budget, BudgetLine
from .serializers import (
    BudgetSerializer,
    BudgetWriteSerializer,
    BudgetLineSerializer,
)
from .services import get_revenue_for_year


class BudgetViewSet(viewsets.ModelViewSet):
    queryset = Budget.objects.prefetch_related('budgetline_set__linked_property').all()
    permission_classes = [IsAdminOrFinanceOfficer]

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return BudgetWriteSerializer
        return BudgetSerializer

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """
        Close (approve) a budget. Any unspent portion is released back to
        available revenue so a future budget can draw against it.
        """
        budget = self.get_object()
        if budget.is_closed:
            return Response(
                {'detail': f'Budget {budget.year} is already closed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        budget.is_closed = True
        budget.closed_at = timezone.now()
        budget.save(update_fields=['is_closed', 'closed_at'])
        released = budget.total_budget - (
            budget.budgetline_set.aggregate(t=Sum('spent_amount'))['t'] or Decimal('0')
        )
        return Response({
            'message': f'Budget {budget.year} closed. Released {released} back to available revenue.',
            'budget': BudgetSerializer(budget).data,
        })

    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        """
        Reopen a previously closed budget (mistake correction). Its full
        `total_budget` is re-committed against revenue.
        """
        budget = self.get_object()
        if not budget.is_closed:
            return Response(
                {'detail': f'Budget {budget.year} is not closed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        budget.is_closed = False
        budget.closed_at = None
        budget.save(update_fields=['is_closed', 'closed_at'])
        return Response({
            'message': f'Budget {budget.year} reopened.',
            'budget': BudgetSerializer(budget).data,
        })


class BudgetLineViewSet(viewsets.ModelViewSet):
    queryset = BudgetLine.objects.select_related('linked_property', 'budget').all()
    serializer_class = BudgetLineSerializer
    permission_classes = [IsAdminOrFinanceOfficer]

    def get_queryset(self):
        qs = super().get_queryset()
        budget_id = self.request.query_params.get('budget')
        category = self.request.query_params.get('category')
        if budget_id:
            qs = qs.filter(budget_id=budget_id)
        if category:
            qs = qs.filter(category=category)
        return qs


class RevenueSummaryView(APIView):
    permission_classes = [IsAdminOrFinanceOfficer]

    def get(self, request):
        year = request.query_params.get('year')
        revenue = get_revenue_for_year(year)
        payments = Payment.objects.select_related('invoice__lease__tenant').order_by('-payment_date')
        if year:
            payments = payments.filter(payment_date__year=year)

        return Response({
            'year': year,
            'total_revenue': str(revenue),
            'payment_count': payments.count(),
            'recent_payments': PaymentSerializer(payments[:20], many=True).data,
        })


class FinanceDashboardView(APIView):
    permission_classes = [IsAdminOrFinanceOfficer]

    def get(self, request):
        year = request.query_params.get('year') or str(__import__('datetime').date.today().year)
        revenue = get_revenue_for_year(year)

        budgets = Budget.objects.filter(year=year).prefetch_related('budgetline_set')
        budget_data = BudgetSerializer(budgets, many=True).data

        total_budget = budgets.aggregate(t=Sum('total_budget'))['t'] or Decimal('0')
        lines = BudgetLine.objects.filter(budget__year=year)
        opex = lines.filter(category='opex').aggregate(
            allocated=Sum('allocated_amount'), spent=Sum('spent_amount'),
        )
        capex = lines.filter(category='capex').aggregate(
            allocated=Sum('allocated_amount'), spent=Sum('spent_amount'),
        )

        payments = Payment.objects.filter(payment_date__year=year).order_by('-payment_date')[:10]

        return Response({
            'year': year,
            'total_revenue': str(revenue),
            'total_budget_planned': str(total_budget),
            'budget_within_revenue': total_budget <= revenue if revenue else True,
            'opex': {
                'allocated': str(opex['allocated'] or 0),
                'spent': str(opex['spent'] or 0),
            },
            'capex': {
                'allocated': str(capex['allocated'] or 0),
                'spent': str(capex['spent'] or 0),
            },
            'budgets': budget_data,
            'recent_payments': PaymentSerializer(payments, many=True).data,
        })


class FinancialReportView(APIView):
    permission_classes = [IsAdminOrLeaseOrFinance]

    def get(self, request):
        year = request.query_params.get('year')
        payment_qs = Payment.objects.all()
        invoice_qs = Invoice.objects.filter(status='paid')

        if year:
            payment_qs = payment_qs.filter(payment_date__year=year)
            invoice_qs = invoice_qs.filter(issue_date__year=year)

        total_received = payment_qs.aggregate(total=Sum('amount_paid'))['total'] or Decimal('0')

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

        asset_breakdown = []
        for line in line_qs.select_related('linked_property'):
            asset_breakdown.append({
                'asset': line.linked_property.name if line.linked_property else 'General',
                'asset_code': line.linked_property.asset_code if line.linked_property else None,
                'category': line.category,
                'description': line.description,
                'allocated': str(line.allocated_amount),
                'spent': str(line.spent_amount),
            })

        return Response({
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
            'asset_breakdown': asset_breakdown,
        })
