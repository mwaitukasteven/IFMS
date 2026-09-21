"""
DEPRECIATION APP — URL Routes

Routes for the depreciation module — mounted at /api/depreciation/ in
the main urls.py.

DRF's DefaultRouter auto-generates:
  /api/depreciation/policies/                          → list & create policies
  /api/depreciation/policies/<id>/                     → retrieve/update/delete policy
  /api/depreciation/policies/<id>/generate_schedule/   → run the depreciation engine
  /api/depreciation/policies/stats/                    → dashboard statistics

  /api/depreciation/schedules/                         → list & create schedule rows
  /api/depreciation/schedules/<id>/                    → retrieve/update/delete schedule row
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DepreciationPolicyViewSet, DepreciationScheduleViewSet

# Register both viewsets with the router
router = DefaultRouter()
router.register(r'policies', DepreciationPolicyViewSet, basename='policy')
router.register(r'schedules', DepreciationScheduleViewSet, basename='schedule')

urlpatterns = [
    path('', include(router.urls)),
]
