"""
Notification + email services.

Design invariants:
- Every notification that lands in a tenant's inbox is also emailed to their
  address on file. This is enforced by routing all tenant-facing notifications
  through `notify_tenant`.
- Email delivery never breaks the surrounding request: SMTP errors are logged
  and swallowed inside `safe_send_mail`.
"""

import logging

from django.conf import settings
from django.core.mail import send_mail

from notifications.models import Notification


logger = logging.getLogger(__name__)


def safe_send_mail(subject, body, recipients):
    """
    Send an email, but never let SMTP failures propagate to the caller.

    Returns True on success, False if the send failed (still logged).
    Empty recipient lists are treated as no-op.
    """
    recipients = [r for r in (recipients or []) if r]
    if not recipients:
        return False
    try:
        send_mail(
            subject,
            body,
            settings.DEFAULT_FROM_EMAIL,
            recipients,
            fail_silently=False,
        )
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning('Email send failed (subject=%r, to=%r): %s', subject, recipients, exc)
        return False


def _property_name(prop):
    """Return the display name for a property/asset foreign key."""
    if prop is None:
        return ''
    return getattr(prop, 'name', None) or getattr(prop, 'asset_name', '') or ''


def notify_tenant(tenant, title, message, send_email=True):
    """
    Create an in-app notification for a tenant and email them by default.

    All tenant-facing notification code paths should call this helper so that
    the "email = notification" invariant holds automatically.
    """
    if tenant is None:
        return
    if getattr(tenant, 'user', None):
        Notification.objects.create(user=tenant.user, title=title, message=message)
    if send_email and getattr(tenant, 'email', None):
        body = (
            f'Dear {tenant.full_name},\n\n'
            f'{message}\n\n'
            f'Regards,\nFinancial Management System'
        )
        safe_send_mail(title, body, [tenant.email])


# Backwards-compatible alias
send_tenant_notification = notify_tenant


def notify_tenant_welcome(tenant, username, temp_password):
    """Sent when a lease officer registers a new tenant."""
    login_url = f'{getattr(settings, "FRONTEND_URL", "http://localhost:5173")}/login'
    title = 'Welcome to the Financial Management System'
    message = (
        f'Your tenant account has been created.\n\n'
        f'Login username: {username}\n'
        f'Temporary password: {temp_password}\n\n'
        f'Please sign in at {login_url} and change your password on first use.'
    )
    notify_tenant(tenant, title, message)


def send_lease_contract_email(lease):
    """Kept for callers that only want the email (no in-app notification)."""
    tenant = lease.tenant
    prop = _property_name(lease.property)
    subject = f'Lease Agreement {lease.lease_number} - {prop}'
    unit = lease.unit.unit_number if lease.unit else 'Whole property'
    body = (
        f'Dear {tenant.full_name},\n\n'
        f'A lease agreement has been created for you.\n\n'
        f'Contract: {lease.lease_number}\n'
        f'Property: {prop}\n'
        f'Unit: {unit}\n'
        f'Period: {lease.start_date} to {lease.end_date}\n'
        f'Monthly rent: {lease.monthly_rent}\n'
        f'Status: {lease.status}\n\n'
        f'Please log in to your tenant dashboard to view and download your contract.\n\n'
        f'Regards,\nLease Management Team'
    )
    safe_send_mail(subject, body, [tenant.email])


def notify_lease_created(lease):
    """New-lease notification (in-app + email) sent to the tenant."""
    title = f'New lease agreement - {lease.lease_number}'
    prop = _property_name(lease.property)
    unit = lease.unit.unit_number if lease.unit else 'Whole property'
    message = (
        f'A lease agreement has been created for you.\n\n'
        f'Contract: {lease.lease_number}\n'
        f'Property: {prop}\n'
        f'Unit: {unit}\n'
        f'Period: {lease.start_date} to {lease.end_date}\n'
        f'Monthly rent: {lease.monthly_rent}\n\n'
        f'View and download your contract from your tenant dashboard.'
    )
    notify_tenant(lease.tenant, title, message)


def notify_invoice_issued(invoice):
    """Notify the tenant when a new invoice has been issued to them."""
    lease = invoice.lease
    tenant = lease.tenant
    title = f'New invoice - {invoice.invoice_number}'
    message = (
        f'A new invoice has been issued for your lease {lease.lease_number}.\n\n'
        f'Invoice: {invoice.invoice_number}\n'
        f'Property: {_property_name(lease.property)}\n'
        f'Amount due: {invoice.amount}\n'
        f'Issue date: {invoice.issue_date}\n'
        f'Due date: {invoice.due_date}\n\n'
        f'Please log in to your tenant dashboard to review the invoice and submit payment.'
    )
    notify_tenant(tenant, title, message)


def notify_payment_confirmed(confirmation):
    """Notify the tenant that their payment submission was confirmed."""
    invoice = confirmation.invoice
    tenant = invoice.lease.tenant
    title = f'Payment confirmed - {invoice.invoice_number}'
    message = (
        f'Your payment for invoice {invoice.invoice_number} has been confirmed.\n\n'
        f'Amount confirmed: {confirmation.amount_paid}\n'
        f'Reference: {confirmation.reference_number}\n'
        f'Payment date: {confirmation.payment_date}\n\n'
        f'Thank you for your payment.'
    )
    notify_tenant(tenant, title, message)


def notify_payment_rejected(confirmation, reason=''):
    """Notify the tenant that their payment submission was rejected."""
    invoice = confirmation.invoice
    tenant = invoice.lease.tenant
    title = f'Payment rejected - {invoice.invoice_number}'
    detail = f'Reason: {reason}\n\n' if reason else ''
    message = (
        f'Your payment submission for invoice {invoice.invoice_number} was rejected.\n\n'
        f'Amount submitted: {confirmation.amount_paid}\n'
        f'Reference: {confirmation.reference_number}\n\n'
        f'{detail}'
        f'Please review the payment details and resubmit, or contact the lease office for assistance.'
    )
    notify_tenant(tenant, title, message)


def send_password_reset_email(user, reset_link):
    """Password-reset email — plain SMTP, no in-app notification."""
    subject = 'Password reset request'
    body = (
        f'Hi {user.first_name or user.username},\n\n'
        f'We received a request to reset your password.\n\n'
        f'Reset your password using this link:\n{reset_link}\n\n'
        f'If you did not request this, you can safely ignore this email.\n\n'
        f'Regards,\nFinancial Management System'
    )
    safe_send_mail(subject, body, [user.email])


def send_new_user_credentials(user, temporary_password):
    """Email a newly registered non-tenant user their login instructions."""
    login_url = f'{getattr(settings, "FRONTEND_URL", "http://localhost:5173")}/login'
    subject = 'Welcome to the Financial Management System'
    body = (
        f'Hi {user.first_name or user.username},\n\n'
        f'An administrator has created an account for you in the '
        f'Financial Management System.\n\n'
        f'Login URL   : {login_url}\n'
        f'Username    : {user.username}\n'
        f'Email       : {user.email}\n'
        f'Temporary password: {temporary_password}\n\n'
        f'For your first login, use your username or email together with '
        f'the temporary password shown above. You will be asked to set a '
        f'new password immediately after signing in.\n\n'
        f'Regards,\nSystem Administrator'
    )
    safe_send_mail(subject, body, [user.email])
