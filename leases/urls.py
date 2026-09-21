from rest_framework.routers import DefaultRouter

from .views import LeaseAgreementViewSet, MyLeaseViewSet

router = DefaultRouter()
router.register(r'leases', LeaseAgreementViewSet)
router.register(r'my-contracts', MyLeaseViewSet, basename='my-leases')

urlpatterns = router.urls
