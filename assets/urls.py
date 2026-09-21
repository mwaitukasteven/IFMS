"""
ASSETS APP — URL Routes

Routes for assets module — mounted at /api/assets/ in main urls.py.

DRF's DefaultRouter auto-generates:
  /api/assets/                  → list & create assets
  /api/assets/<id>/             → retrieve/update/delete one asset
  /api/assets/<id>/valuations/  → asset's valuations (custom action)
  /api/assets/<id>/events/      → asset's events (custom action)
  /api/assets/stats/            → dashboard stats (custom action)

  /api/assets/valuations/       → list & create valuations
  /api/assets/valuations/<id>/  → retrieve/update/delete one valuation

  /api/assets/events/           → list & create events
  /api/assets/events/<id>/      → retrieve/update/delete one event
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AssetViewSet, AssetValuationViewSet, AssetEventViewSet

# Order matters! Register valuations and events BEFORE assets so
# /api/assets/valuations/ isn't captured by /api/assets/<id>/
router = DefaultRouter()
router.register(r'valuations', AssetValuationViewSet, basename='valuation')
router.register(r'events', AssetEventViewSet, basename='event')
router.register(r'', AssetViewSet, basename='asset')

urlpatterns = [
    path('', include(router.urls)),
]