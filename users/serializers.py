"""
USERS APP — Serializers

Unified serializers combining Patrick's asset-side user management with
the ASSET-side auth rules (LASTNAME default password, must_change_password
flag, username-or-email login).
"""

from rest_framework import serializers

from .auth_utils import authenticate_login, default_password_from_last_name
from .models import User, UserProfile


class UserSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'first_name', 'last_name', 'full_name',
            'email', 'role', 'role_display', 'phone_number',
            'status', 'must_change_password',
            'is_active', 'is_staff', 'date_joined', 'last_login', 'created_at',
        ]
        read_only_fields = ['id', 'date_joined', 'last_login', 'created_at']


class UserProfileSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'first_name', 'last_name', 'full_name',
            'email', 'role', 'role_display', 'phone_number',
            'must_change_password',
        ]


class LoginSerializer(serializers.Serializer):
    """Accepts either a username or an email in the `username` field."""
    username = serializers.CharField()
    password = serializers.CharField()

    def validate(self, attrs):
        user = authenticate_login(attrs['username'], attrs['password'])
        if user is None:
            raise serializers.ValidationError('Invalid username or password')
        if not user.is_active:
            raise serializers.ValidationError('User account is disabled')
        attrs['user'] = user
        return attrs


class CreateUserSerializer(serializers.ModelSerializer):
    """Admin-only user creation. First-login password = LASTNAME uppercase."""

    class Meta:
        model = User
        fields = [
            'username', 'first_name', 'last_name', 'email',
            'role', 'phone_number', 'full_name',
        ]

    def validate_role(self, value):
        allowed = [choice[0] for choice in User.ROLE_CHOICES]
        if value not in allowed:
            raise serializers.ValidationError(f'Role must be one of {allowed}')
        return value

    def create(self, validated_data):
        full_name = validated_data.pop('full_name', '') or (
            f"{validated_data.get('first_name', '')} {validated_data.get('last_name', '')}".strip()
        )
        user = User(
            username=validated_data['username'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            full_name=full_name,
            email=validated_data['email'],
            role=validated_data['role'],
            phone_number=validated_data.get('phone_number', ''),
            must_change_password=True,
        )
        user.set_password(default_password_from_last_name(validated_data.get('last_name', '')))
        user.save()
        return user


class UpdateUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'full_name', 'email',
            'role', 'phone_number', 'status', 'is_active',
        ]


class AdminResetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(required=False, allow_blank=True)

    def validate_new_password(self, value):
        if value and len(value) < 4:
            raise serializers.ValidationError('Password must be at least 4 characters.')
        return value


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField()
    new_password = serializers.CharField(min_length=8)

    def validate_new_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError('Password must be at least 8 characters.')
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8)
