"""
INTEGRATION APP — Django Admin

Registers IntegrationClient and IntegrationLog with Django's built-in
admin interface so Patrick can also manage them from /admin/ (in
addition to the React dashboard).
"""

from django.contrib import admin
from .models import IntegrationClient, IntegrationLog


@admin.register(IntegrationClient)
class IntegrationClientAdmin(admin.ModelAdmin):
    """Admin UI for managing external API clients."""

    list_display = ('name', 'is_active', 'last_used_at', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'contact_email', 'description')

    # The api_key is sensitive — show it but don't let it be edited by
    # hand (changes go through the rotate_key endpoint instead).
    readonly_fields = ('id', 'api_key', 'last_used_at', 'created_at', 'updated_at')

    fieldsets = (
        ('Identity', {
            'fields': ('id', 'name', 'description', 'contact_email')
        }),
        ('Access', {
            'fields': ('api_key', 'is_active', 'last_used_at'),
            'description': (
                'The api_key is auto-generated on creation. To rotate it, '
                'use the "Rotate API key" action on the client list.'
            ),
        }),
        ('Audit', {
            'fields': ('created_at', 'updated_at')
        }),
    )

    actions = ['rotate_api_keys']

    # Admin bulk action — generates fresh keys for all selected clients
    @admin.action(description='Rotate API key for selected clients')
    def rotate_api_keys(self, request, queryset):
        rotated = 0
        for client in queryset:
            client.rotate_api_key()
            rotated += 1
        self.message_user(request, f'Rotated {rotated} API key(s).')


@admin.register(IntegrationLog)
class IntegrationLogAdmin(admin.ModelAdmin):
    """Audit log of every call from external systems."""

    list_display = ('called_at', 'client', 'method', 'endpoint', 'status_code', 'ip_address')
    list_filter = ('method', 'status_code', 'client')
    search_fields = ('endpoint', 'message', 'ip_address')
    readonly_fields = (
        'id', 'client', 'method', 'endpoint',
        'status_code', 'ip_address', 'message', 'called_at',
    )

    # Logs are written by the system — never created from the admin.
    def has_add_permission(self, request):
        return False
