"""
USERS APP — Models

Unified user model for the merged Asset + Lease + Budget system.

Roles supported (all managed by the admin):
  - admin           : registers every other actor, oversees the whole system
  - asset_manager   : registers assets, valuations, lifecycle events, policies
  - finance_officer : depreciation schedules, revenue tracking, budget planning
  - lease_officer   : manages tenants, leases, invoices, payment confirmations
  - tenant          : views own contracts, invoices, notifications

Login rules (ported from the ASSET side of the merge):
  - Login by username OR email
  - Initial password = user's LAST NAME in capital letters
  - must_change_password flag forces a password change after first login
"""

import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    ROLE_ADMIN = 'admin'
    ROLE_ASSET_MANAGER = 'asset_manager'
    ROLE_FINANCE_OFFICER = 'finance_officer'
    ROLE_LEASE_OFFICER = 'lease_officer'
    ROLE_TENANT = 'tenant'

    ROLE_CHOICES = (
        (ROLE_ADMIN, 'Administrator'),
        (ROLE_ASSET_MANAGER, 'Asset Manager'),
        (ROLE_FINANCE_OFFICER, 'Finance Officer'),
        (ROLE_LEASE_OFFICER, 'Lease Officer'),
        (ROLE_TENANT, 'Tenant'),
    )

    STATUS_ACTIVE = 'active'
    STATUS_INACTIVE = 'inactive'
    STATUS_SUSPENDED = 'suspended'

    STATUS_CHOICES = (
        (STATUS_ACTIVE, 'Active'),
        (STATUS_INACTIVE, 'Inactive'),
        (STATUS_SUSPENDED, 'Suspended'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)

    role = models.CharField(
        max_length=30,
        choices=ROLE_CHOICES,
        blank=True,
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_ACTIVE,
    )

    must_change_password = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date_joined']
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return self.full_name or self.username

    def is_admin(self):
        return self.is_superuser or self.role == self.ROLE_ADMIN

    def is_asset_manager(self):
        return self.role == self.ROLE_ASSET_MANAGER

    def is_finance_officer(self):
        return self.role == self.ROLE_FINANCE_OFFICER

    def is_lease_officer(self):
        return self.role == self.ROLE_LEASE_OFFICER

    def is_tenant(self):
        return self.role == self.ROLE_TENANT


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    profile_picture = models.ImageField(upload_to='profiles/', blank=True, null=True)
    address = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Profile of {self.user}"
