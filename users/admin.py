"""
USERS APP — Django Admin Configuration

The admin panel enforces the same first-login rule as the API:
when an admin creates a new user, the password is set automatically
to the user's LAST NAME in UPPERCASE and `must_change_password` is
flipped on. The admin does NOT type a password.
"""

from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .auth_utils import default_password_from_last_name
from .models import User, UserProfile


class MergedUserCreationForm(forms.ModelForm):
    """
    Custom "Add User" form for the Django admin.

    No password fields — the initial password is derived from
    `last_name` (uppercased) and the user is forced to change it
    on first login.
    """

    class Meta:
        model = User
        fields = (
            'username', 'first_name', 'last_name', 'email',
            'full_name', 'phone_number', 'role', 'status',
        )

    def clean_last_name(self):
        last_name = self.cleaned_data.get('last_name', '').strip()
        if not last_name:
            raise forms.ValidationError(
                'Last name is required — the initial password is derived from it.'
            )
        return last_name

    def save(self, commit=True):
        user = super().save(commit=False)
        last_name = self.cleaned_data.get('last_name', '')
        user.set_password(default_password_from_last_name(last_name))
        user.must_change_password = True
        if not user.full_name:
            first = self.cleaned_data.get('first_name', '')
            user.full_name = f"{first} {last_name}".strip()
        if commit:
            user.save()
        return user


class MergedUserChangeForm(forms.ModelForm):
    """Edit form — no password field either. Use the 'reset password' action instead."""

    class Meta:
        model = User
        fields = (
            'username', 'first_name', 'last_name', 'full_name',
            'email', 'phone_number', 'role', 'status',
            'is_active', 'is_staff', 'is_superuser',
            'must_change_password', 'groups', 'user_permissions',
        )


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    add_form = MergedUserCreationForm
    form = MergedUserChangeForm

    list_display = [
        'username', 'email', 'full_name', 'role',
        'status', 'must_change_password', 'is_active',
    ]
    list_filter = ['role', 'status', 'is_active', 'must_change_password']
    search_fields = [
        'username', 'email', 'full_name',
        'first_name', 'last_name', 'phone_number',
    ]
    ordering = ['-date_joined']

    # Edit view — grouped fieldsets.
    fieldsets = (
        (None, {'fields': ('username',)}),
        ('Personal info', {
            'fields': ('first_name', 'last_name', 'full_name', 'email', 'phone_number'),
        }),
        ('Role & status', {
            'fields': ('role', 'status', 'must_change_password'),
        }),
        ('Permissions', {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
        }),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )

    # Add view — NO password fields. Password is derived from last name.
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': (
                'username', 'first_name', 'last_name',
                'email', 'phone_number', 'role',
            ),
            'description': (
                'The initial password is the user\'s last name in '
                'UPPERCASE. They will be forced to change it on first login.'
            ),
        }),
    )

    def save_model(self, request, obj, form, change):
        """
        For NEW users, always (re)set the password to the last-name
        default and flip must_change_password on — even if a superuser
        opens the edit page and adjusts the last_name.
        """
        if not change:
            obj.set_password(default_password_from_last_name(obj.last_name))
            obj.must_change_password = True
            if not obj.full_name:
                obj.full_name = f"{obj.first_name} {obj.last_name}".strip()
        super().save_model(request, obj, form, change)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'created_at']
    search_fields = ['user__username', 'user__email']
