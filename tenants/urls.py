from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import TenantViewSet, MyTenantProfileViewSet

router = DefaultRouter()
router.register(r'tenants', TenantViewSet)
router.register(r'profile', MyTenantProfileViewSet, basename='tenant-profile')

urlpatterns = router.urls
