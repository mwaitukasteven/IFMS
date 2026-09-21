from rest_framework import serializers

from users.auth_utils import default_password_from_last_name
from leases.models import LeaseAgreement
from .models import Tenant


class TenantSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    active_leases = serializers.SerializerMethodField()

    class Meta:
        model = Tenant
        fields = [
            'id', 'user', 'username', 'first_name', 'last_name',
            'full_name', 'email', 'phone_number', 'address', 'created_at',
            'active_leases',
        ]
        read_only_fields = ['user']

    def get_active_leases(self, obj):
        leases = LeaseAgreement.objects.filter(tenant=obj, status='active').select_related('property')
        return [
            {
                'id': l.id,
                'lease_number': l.lease_number,
                'property_name': l.property.name,
                'end_date': str(l.end_date),
            }
            for l in leases
        ]


class CreateTenantSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    username = serializers.CharField(max_length=150, required=False, allow_blank=True)
    email = serializers.EmailField()
    phone_number = serializers.CharField(max_length=20)
    address = serializers.CharField()

    def validate_email(self, value):
        from users.models import User
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        if Tenant.objects.filter(email=value).exists():
            raise serializers.ValidationError('A tenant with this email already exists.')
        return value

    def validate_username(self, value):
        from users.models import User
        if value and User.objects.filter(username=value).exists():
            raise serializers.ValidationError('This username is already taken.')
        return value

    def create(self, validated_data):
        from users.models import User
        username = validated_data.get('username') or validated_data['email'].split('@')[0]
        base_username = username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f'{base_username}{counter}'
            counter += 1

        user = User(
            username=username,
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            email=validated_data['email'],
            role='tenant',
            phone_number=validated_data['phone_number'],
            must_change_password=True,
        )
        user.set_password(default_password_from_last_name(validated_data['last_name']))
        user.is_active = True
        user.save()

        full_name = f"{validated_data['first_name']} {validated_data['last_name']}".strip()
        return Tenant.objects.create(
            user=user,
            full_name=full_name,
            email=validated_data['email'],
            phone_number=validated_data['phone_number'],
            address=validated_data['address'],
        )


class SendTenantNotificationSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    message = serializers.CharField()
    send_email = serializers.BooleanField(default=True)


class TenantResetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(required=False, allow_blank=True)

    def validate_new_password(self, value):
        if value and len(value) < 4:
            raise serializers.ValidationError('Password must be at least 4 characters.')
        return value


class UpdateTenantSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Tenant
        fields = ['full_name', 'email', 'phone_number', 'address', 'first_name', 'last_name']

    def update(self, instance, validated_data):
        from users.models import User

        first_name = validated_data.pop('first_name', None)
        last_name = validated_data.pop('last_name', None)
        user = instance.user

        if first_name is not None:
            user.first_name = first_name
        if last_name is not None:
            user.last_name = last_name
        if first_name is not None or last_name is not None:
            validated_data['full_name'] = f'{user.first_name} {user.last_name}'.strip()

        if 'email' in validated_data:
            email = validated_data['email']
            if User.objects.exclude(pk=user.pk).filter(email=email).exists():
                raise serializers.ValidationError({'email': 'This email is already in use.'})
            if Tenant.objects.exclude(pk=instance.pk).filter(email=email).exists():
                raise serializers.ValidationError({'email': 'This email is already in use.'})
            user.email = email

        if 'phone_number' in validated_data:
            user.phone_number = validated_data['phone_number']

        user.save()
        return super().update(instance, validated_data)
