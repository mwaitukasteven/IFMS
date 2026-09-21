"""
USERS APP — Authentication URL Routes

Mounted at /api/auth/ in the main urls.py.

Routes:
  POST /api/auth/login/                    (username OR email + password)
  POST /api/auth/refresh/                  (JWT refresh)
  POST /api/auth/logout/                   (blacklists refresh token)
  GET  /api/auth/me/                       (current user info)
  POST /api/auth/change-password/          (forced after first login)
  POST /api/auth/password-reset/           (email token)
  POST /api/auth/password-reset/confirm/   (submit new password)
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    ChangePasswordView,
    LoginView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    logout_user,
)

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', logout_user, name='logout'),
    path('me/', MeView.as_view(), name='current_user'),
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password_reset'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
]
