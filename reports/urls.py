"""
REPORTS APP — URL Routes

Mounted at /api/reports/.

Existing valuation/depreciation/NBV reports:
  /api/reports/reports/                          list & create reports
  /api/reports/reports/<id>/                     retrieve/update/delete
  /api/reports/reports/<id>/generate/            populate line items
  /api/reports/reports/<id>/export_csv/          download CSV
  /api/reports/reports/<id>/export_pdf/          download PDF
  /api/reports/reports/stats/                    dashboard stats

  /api/reports/line-items/                       line items (read-only)
  /api/reports/line-items/<id>/                  one line item

Cross-module reports (added after the merge):
  /api/reports/lease-report/                     lease summary
  /api/reports/revenue-report/                   payment revenue
  /api/reports/budget-report/                    budget vs. spend + revenue
  /api/reports/overall-report/                   combined finance overview
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .extra_reports import (
    AssetReportView,
    BudgetReportView,
    LeaseReportView,
    OverallReportView,
    RevenueReportView,
)
from .views import FinancialReportViewSet, ReportLineItemViewSet

router = DefaultRouter()
router.register(r'reports', FinancialReportViewSet, basename='report')
router.register(r'line-items', ReportLineItemViewSet, basename='line-item')

urlpatterns = [
    path('lease-report/', LeaseReportView.as_view(), name='lease-report'),
    path('revenue-report/', RevenueReportView.as_view(), name='revenue-report'),
    path('budget-report/', BudgetReportView.as_view(), name='budget-report'),
    path('asset-report/', AssetReportView.as_view(), name='asset-report'),
    path('overall-report/', OverallReportView.as_view(), name='overall-report'),
    path('', include(router.urls)),
]
