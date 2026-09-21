from django.contrib import admin
from .models import Payment, PaymentConfirmation


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['id', 'invoice', 'amount_paid', 'payment_date', 'payment_method', 'created_at']
    list_filter = ['payment_date', 'payment_method', 'created_at']
    search_fields = ['invoice__invoice_number', 'reference_number']
    readonly_fields = ['created_at']


@admin.register(PaymentConfirmation)
class PaymentConfirmationAdmin(admin.ModelAdmin):
    list_display = ['id', 'invoice', 'amount_paid', 'payment_date', 'status', 'created_at']
    list_filter = ['status', 'payment_date', 'created_at']
    search_fields = ['invoice__invoice_number', 'reference_number']
    readonly_fields = ['created_at', 'updated_at', 'confirmed_at']
    fieldsets = (
        ('Payment Information', {
            'fields': ('invoice', 'amount_paid', 'payment_date', 'payment_method', 'reference_number')
        }),
        ('Confirmation', {
            'fields': ('status', 'confirmed_by', 'confirmed_at')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
