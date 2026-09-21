"""
INTEGRATION APP — URL Routes

Mounted at /api/integration/ by patrick_backend/urls.py.

DRF's DefaultRouter auto-generates standard list/retrieve routes for
each ViewSet and custom routes for each @action.

EXTERNAL endpoints (X-API-Key auth, read-only):
  /api/integration/assets/                          list assets
  /api/integration/assets/<id>/                     one asset (detail + history)
  /api/integration/assets/by_code/<asset_code>/     asset lookup by code
  /api/integration/assets/summary/                  headline totals

  /api/integration/depreciation/                    list schedule rows
  /api/integration/depreciation/<id>/               one schedule row
  /api/integration/depreciation/by_asset/<asset_id>/ schedule for one asset

INTERNAL admin endpoints (JWT + IsAdminUser):
  /api/integration/clients/                         CRUD api keys
  /api/integration/clients/<id>/                    one client
  /api/integration/clients/<id>/rotate_key/         issue fresh key

  /api/integration/logs/                            audit log list
  /api/integration/logs/<id>/                       single log entry
  /api/integration/logs/stats/                      dashboard stats
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    ExternalAssetViewSet,
    ExternalDepreciationViewSet,
    IntegrationClientViewSet,
    IntegrationLogViewSet,
)


router = DefaultRouter()
# External endpoints (consumed by Stephen's lease/budget system)
router.register(r'assets', ExternalAssetViewSet, basename='integration-asset')
router.register(r'depreciation', ExternalDepreciationViewSet, basename='integration-depreciation')

# Internal admin endpoints (used by Patrick's React UI)
router.register(r'clients', IntegrationClientViewSet, basename='integration-client')
router.register(r'logs', IntegrationLogViewSet, basename='integration-log')

urlpatterns = [
    path('', include(router.urls)),
]
