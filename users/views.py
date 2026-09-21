"""
USERS APP — API Views

Unified user + auth endpoints for the merged system.

Endpoints:
  POST /api/auth/login/                     public   (username OR email + password)
  POST /api/auth/refresh/                   public   (JWT refresh)
  POST /api/auth/logout/                    auth     (blacklists refresh token)
  GET  /api/auth/me/                        auth     (current user info)
  POST /api/auth/change-password/           auth     (forced after first login)
  POST /api/auth/password-reset/            public   (email token)
  POST /api/auth/password-reset/confirm/    public   (submit new password)

  GET/POST/PATCH/DELETE /api/users/         admin    (CRUD any user, any role)
  POST /api/users/<id>/reset-password/      admin    (reset password to LASTNAME)
  GET  /api/users/roles/                    auth     (list role choices)
"""

from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .auth_utils import default_password_from_last_name
from .models import User
from .permissions import IsAdmin
from .serializers import (
    AdminResetPasswordSerializer,
    ChangePasswordSerializer,
    CreateUserSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    UpdateUserSerializer,
    UserProfileSerializer,
    UserSerializer,
)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']

        if not user.is_active:
            return Response(
                {'detail': 'User account is disabled'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        refresh = RefreshToken.for_user(user)
        refresh['role'] = user.role
        refresh['username'] = user.username
        refresh['email'] = user.email
        refresh['full_name'] = user.full_name

        if not user.role and user.is_superuser:
            user.role = User.ROLE_ADMIN
            user.save(update_fields=['role'])

        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'role': user.role,
            'username': user.username,
            'email': user.email,
            'full_name': user.full_name,
            'must_change_password': user.must_change_password,
            'user': UserSerializer(user).data,
        })


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserProfileSerializer(request.user).data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        if not user.check_password(serializer.validated_data['old_password']):
            return Response({'error': 'Wrong password'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(serializer.validated_data['new_password'])
        user.must_change_password = False
        user.save(update_fields=['password', 'must_change_password'])
        return Response({'message': 'Password changed successfully'})


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        user = User.objects.filter(email__iexact=email).first()
        if user:
            from django.conf import settings
            from django.contrib.auth.tokens import default_token_generator
            from django.utils.http import urlsafe_base64_encode
            from django.utils.encoding import force_bytes

            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
            reset_link = f'{frontend_url}/reset-password?uid={uid}&token={token}'

            try:
                from notifications.services import send_password_reset_email
                send_password_reset_email(user, reset_link)
            except Exception:
                pass

        return Response({
            'message': 'If an account exists with that email, a reset link has been sent.',
        })


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_decode
        from django.utils.encoding import force_str

        try:
            uid = force_str(urlsafe_base64_decode(serializer.validated_data['uid']))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({'error': 'Invalid reset link.'}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, serializer.validated_data['token']):
            return Response({'error': 'Invalid or expired reset token.'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(serializer.validated_data['new_password'])
        user.must_change_password = False
        user.save(update_fields=['password', 'must_change_password'])
        return Response({'message': 'Password reset successfully. You can now log in.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_user(request):
    """Blacklist the given refresh token."""
    try:
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response(
                {'error': 'Refresh token required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        RefreshToken(refresh_token).blacklist()
        return Response({'message': 'Successfully logged out'})
    except Exception as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class UserViewSet(viewsets.ModelViewSet):
    """Admin CRUD for every user in the system, regardless of role."""

    queryset = User.objects.all().order_by('-created_at')
    permission_classes = [IsAdmin]

    def get_serializer_class(self):
        if self.action == 'create':
            return CreateUserSerializer
        if self.action in ('update', 'partial_update'):
            return UpdateUserSerializer
        return UserSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get('search', '').strip()
        role = self.request.query_params.get('role', '').strip()
        if search:
            qs = qs.filter(
                Q(username__icontains=search)
                | Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(full_name__icontains=search)
            )
        if role:
            qs = qs.filter(role=role)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = CreateUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Best-effort: notify the new user of their initial credentials.
        try:
            from notifications.services import send_new_user_credentials
            send_new_user_credentials(
                user,
                default_password_from_last_name(user.last_name),
            )
        except Exception:
            pass

        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='reset-password')
    def reset_password(self, request, pk=None):
        user = self.get_object()
        serializer = AdminResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_password = (
            serializer.validated_data.get('new_password')
            or default_password_from_last_name(user.last_name)
        )
        user.set_password(new_password)
        user.must_change_password = True
        user.save(update_fields=['password', 'must_change_password'])
        return Response({
            'message': 'Password reset successfully.',
            'temporary_password': new_password,
            'must_change_password': True,
        })


class RolesView(APIView):
    """Simple list of available role choices for dropdowns."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        roles = [
            {'name': value, 'display_name': label}
            for value, label in User.ROLE_CHOICES
        ]
        return Response(roles)
