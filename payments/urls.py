from rest_framework.routers import DefaultRouter

from .views import PaymentViewSet, PaymentConfirmationViewSet

router = DefaultRouter()

router.register(
    r'payments',
    PaymentViewSet
)

router.register(
    r'payment-confirmations',
    PaymentConfirmationViewSet,
    basename='payment-confirmation'
)

urlpatterns = router.urls