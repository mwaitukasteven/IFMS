from rest_framework.routers import DefaultRouter

from .views import BuildingViewSet, PropertyUnitViewSet

router = DefaultRouter()
router.register(r'buildings', BuildingViewSet, basename='building')
# Legacy alias — the ASSET frontend still calls /api/properties/properties/
router.register(r'properties', BuildingViewSet, basename='building-legacy')
router.register(r'units', PropertyUnitViewSet, basename='property-unit')

urlpatterns = router.urls
