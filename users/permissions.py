"""
USERS APP — Permission classes

All role checks used across the merged system. Downstream apps
(assets, depreciation, reports, leases, budgets, tenants, invoices,
payments, notifications) import from here rather than duplicating
role strings.
"""

from rest_framework.permissions import BasePermission, SAFE_METHODS

from .models import User


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return (
            user.is_authenticated
            and (user.is_superuser or user.role == User.ROLE_ADMIN)
        )


# Alias kept for compatibility with Patrick's existing views/routers.
IsAdministrator = IsAdmin


class IsAssetManager(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return (
            user.is_authenticated
            and (user.is_superuser or user.role == User.ROLE_ASSET_MANAGER)
        )


class IsFinanceOfficer(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return (
            user.is_authenticated
            and (user.is_superuser or user.role == User.ROLE_FINANCE_OFFICER)
        )


class IsLeaseOfficer(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return (
            user.is_authenticated
            and (user.is_superuser or user.role == User.ROLE_LEASE_OFFICER)
        )


class IsTenant(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return user.is_authenticated and user.role == User.ROLE_TENANT


class IsAdminOrAssetManager(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return (
            user.is_authenticated
            and (user.is_superuser or user.role in (User.ROLE_ADMIN, User.ROLE_ASSET_MANAGER))
        )


# Alias — Patrick's existing code uses this name.
IsAssetManagerOrAdmin = IsAdminOrAssetManager


class IsAdminOrFinanceOfficer(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return (
            user.is_authenticated
            and (user.is_superuser or user.role in (User.ROLE_ADMIN, User.ROLE_FINANCE_OFFICER))
        )


IsFinanceOfficerOrAdmin = IsAdminOrFinanceOfficer


class IsAdminOrLeaseOfficer(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return (
            user.is_authenticated
            and (user.is_superuser or user.role in (User.ROLE_ADMIN, User.ROLE_LEASE_OFFICER))
        )


class IsAdminOrLeaseOrFinance(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return (
            user.is_authenticated
            and (user.is_superuser or user.role in (
                User.ROLE_ADMIN,
                User.ROLE_LEASE_OFFICER,
                User.ROLE_FINANCE_OFFICER,
            ))
        )


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return user.is_superuser or user.role == User.ROLE_ADMIN
