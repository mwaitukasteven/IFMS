"""
USERS APP — User Management URL Routes

Mounted at /api/users/ in the main urls.py.

Routes:
  GET  /api/users/roles/          → list role choices for dropdowns
  GET/POST/PATCH/DELETE /api/users/         → CRUD (admin only)
  POST /api/users/<id>/reset-password/      → admin resets password
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import UserViewSet, RolesView

router = DefaultRouter()
router.register(r'', UserViewSet, basename='user')

urlpatterns = [
    path('roles/', RolesView.as_view(), name='roles'),
    path('', include(router.urls)),
]
