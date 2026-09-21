"""
URL Configuration — Merged Asset + Lease + Budget backend.

Path map:
  /admin/                       Django admin
  /api/auth/                    Login, refresh, logout, me, change-password, reset
  /api/users/                   User CRUD (admin)  + role list
  /api/assets/                  Asset registration, valuation, lifecycle
  /api/depreciation/            Depreciation policies + schedules
  /api/reports/                 Financial reports (valuation, depreciation, lease, revenue, budget, overall)
  /api/integration/             External integration (X-API-Key)

  /api/tenants/                 Tenant profiles
  /api/leases/                  Lease agreements
  /api/properties/              Buildings (proxy over assets) + PropertyUnits
  /api/invoices/                Invoices + bank details
  /api/payments/                Payments + payment confirmations
  /api/budgets/                 Budget + budget lines + revenue tracking
  /api/notifications/           In-app notifications
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),

    # Auth & user management (users app)
    path('api/auth/', include('users.urls_auth')),
    path('api/users/', include('users.urls')),

    # Asset-side (Patrick's original modules)
    path('api/assets/', include('assets.urls')),
    path('api/depreciation/', include('depreciation.urls')),
    path('api/reports/', include('reports.urls')),
    path('api/integration/', include('integration.urls')),

    # Lease & finance-side (from the ASSET merge)
    path('api/tenants/', include('tenants.urls')),
    path('api/leases/', include('leases.urls')),
    path('api/properties/', include('properties.urls')),
    path('api/invoices/', include('invoices.urls')),
    path('api/payments/', include('payments.urls')),
    path('api/budgets/', include('budgets.urls')),
    path('api/notifications/', include('notifications.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
