from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.permissions import IsAdminOrLeaseOfficer, IsTenant
from users.auth_utils import default_password_from_last_name
from notifications.services import send_tenant_notification, notify_tenant_welcome
from .models import Tenant
from .serializers import (
    TenantSerializer,
    CreateTenantSerializer,
    UpdateTenantSerializer,
    SendTenantNotificationSerializer,
    TenantResetPasswordSerializer,
)


class TenantViewSet(viewsets.ModelViewSet):
    queryset = Tenant.objects.select_related('user').all()
    permission_classes = [IsAdminOrLeaseOfficer]

    def get_serializer_class(self):
        if self.action == 'create':
            return CreateTenantSerializer
        if self.action in ('update', 'partial_update'):
            return UpdateTenantSerializer
        if self.action == 'send_notification':
            return SendTenantNotificationSerializer
        if self.action == 'reset_password':
            return TenantResetPasswordSerializer
        return TenantSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tenant = serializer.save()
        temp_password = default_password_from_last_name(tenant.user.last_name)
        notify_tenant_welcome(tenant, tenant.user.username, temp_password)
        data = TenantSerializer(tenant).data
        data['default_password'] = temp_password
        return Response(data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        tenant = serializer.save()
        return Response(TenantSerializer(tenant).data)

    @action(detail=True, methods=['post'], url_path='send-notification')
    def send_notification(self, request, pk=None):
        tenant = self.get_object()
        serializer = SendTenantNotificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        send_tenant_notification(
            tenant,
            serializer.validated_data['title'],
            serializer.validated_data['message'],
            serializer.validated_data.get('send_email', True),
        )
        return Response({'message': f'Notification sent to {tenant.full_name}.'})

    @action(detail=True, methods=['post'], url_path='reset-password')
    def reset_password(self, request, pk=None):
        tenant = self.get_object()
        serializer = TenantResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_password = serializer.validated_data.get('new_password') or default_password_from_last_name(tenant.user.last_name)
        tenant.user.set_password(new_password)
        tenant.user.must_change_password = True
        tenant.user.save()
        return Response({
            'message': 'Tenant password reset successfully.',
            'temporary_password': new_password,
            'must_change_password': True,
        })

    @action(detail=True, methods=['post'], url_path='remind-lease-expiry')
    def remind_lease_expiry(self, request, pk=None):
        tenant = self.get_object()
        from leases.models import LeaseAgreement
        from django.utils import timezone
        from datetime import timedelta

        soon = timezone.now().date() + timedelta(days=30)
        expiring = LeaseAgreement.objects.filter(
            tenant=tenant, status='active', end_date__lte=soon,
        ).select_related('property')

        if not expiring.exists():
            return Response(
                {'detail': 'No leases expiring within 30 days.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        for lease in expiring:
            title = f'Lease expiry reminder - {lease.lease_number}'
            message = (
                f'Your lease for {lease.property.name} expires on {lease.end_date}. '
                f'Please contact the lease manager to discuss renewal or move-out arrangements.'
            )
            send_tenant_notification(tenant, title, message, send_email=True)

        return Response({'message': f'Expiry reminder sent for {expiring.count()} lease(s).'})


class MyTenantProfileViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TenantSerializer
    permission_classes = [IsAuthenticated, IsTenant]

    def get_queryset(self):
        return Tenant.objects.filter(user=self.request.user)

    @action(detail=False, methods=['get'])
    def me(self, request):
        tenant = Tenant.objects.filter(user=request.user).first()
        if not tenant:
            return Response({'detail': 'Tenant profile not found.'}, status=404)
        return Response(TenantSerializer(tenant).data)
