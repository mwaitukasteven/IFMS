from rest_framework.routers import DefaultRouter

from .views import InvoiceViewSet, InvoiceBankDetailViewSet, MyInvoiceViewSet

router = DefaultRouter()
router.register(r'invoices', InvoiceViewSet)
router.register(r'bank-details', InvoiceBankDetailViewSet)
router.register(r'my-invoices', MyInvoiceViewSet, basename='my-invoices')

urlpatterns = router.urls
