from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    BudgetViewSet,
    BudgetLineViewSet,
    FinancialReportView,
    RevenueSummaryView,
    FinanceDashboardView,
)
from .report_exports import (
    FinancialSummaryReportView,
    LeaseReportView,
    AssetReportView,
    BudgetReportView,
    OverallReportView,
)

router = DefaultRouter()
router.register(r'budgets', BudgetViewSet)
router.register(r'lines', BudgetLineViewSet)

urlpatterns = router.urls + [
    path('reports/financial/', FinancialReportView.as_view(), name='financial-report'),
    path('revenue/', RevenueSummaryView.as_view(), name='revenue-summary'),
    path('dashboard/', FinanceDashboardView.as_view(), name='finance-dashboard'),
    # Finance-officer report exports (support ?export=json|csv|pdf)
    path('reports/overall/', OverallReportView.as_view(), name='report-overall'),
    path('reports/summary/', FinancialSummaryReportView.as_view(), name='report-summary'),
    path('reports/leases/', LeaseReportView.as_view(), name='report-leases'),
    path('reports/assets/', AssetReportView.as_view(), name='report-assets'),
    path('reports/budgets/', BudgetReportView.as_view(), name='report-budgets'),
]
