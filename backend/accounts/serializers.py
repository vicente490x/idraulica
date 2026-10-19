from datetime import datetime, timezone as dt_timezone
from django.contrib.auth import password_validation
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.tokens import RefreshToken
from .models import AuthSession, User


class LoginSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        attrs['email'] = attrs.get('email', '').strip().lower()
        with transaction.atomic():
            data = super().validate(attrs)
            refresh = RefreshToken(data['refresh'])
            session = AuthSession.objects.create(user=self.user, kind='jwt', expires_at=datetime.fromtimestamp(refresh['exp'], dt_timezone.utc))
            refresh['sid'] = str(session.pk)
            return {'refresh': str(refresh), 'access': str(refresh.access_token)}


class RefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        refresh = RefreshToken(attrs['refresh'])
        with transaction.atomic():
            session = AuthSession.objects.select_for_update().filter(pk=refresh.get('sid'), user_id=refresh['user_id'], kind='jwt', revoked_at__isnull=True, expires_at__gt=timezone.now(), user__is_active=True).first()
            if session is None:
                raise InvalidToken('Sessione scaduta o revocata.')
            # Recheck blacklist after locking: concurrent refresh cannot reuse the same token.
            refresh.check_blacklist()
            data = super().validate(attrs)
            rotated = RefreshToken(data['refresh'])
            session.expires_at = datetime.fromtimestamp(rotated['exp'], dt_timezone.utc)
            session.save(update_fields=['expires_at'])
            return data


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'phone', 'role', 'is_active', 'date_joined', 'last_login', 'password']
        read_only_fields = ['id', 'date_joined', 'last_login']

    def validate_email(self, value):
        value = value.strip().lower()
        query = User.objects.filter(email__iexact=value)
        if self.instance:
            query = query.exclude(pk=self.instance.pk)
        if query.exists():
            raise serializers.ValidationError('Email già utilizzata.')
        return value

    def validate(self, attrs):
        if self.instance is None and 'password' not in attrs:
            raise serializers.ValidationError({'password': 'Password obbligatoria.'})
        if 'password' in attrs:
            candidate = User(email=attrs.get('email', getattr(self.instance, 'email', '')), first_name=attrs.get('first_name', ''), last_name=attrs.get('last_name', ''))
            password_validation.validate_password(attrs['password'], candidate)
        if self.instance and self.instance.role == User.Role.TECHNICIAN and attrs.get('role', self.instance.role) != User.Role.TECHNICIAN and self.instance.interventions.exists():
            raise serializers.ValidationError({'role': 'Il tecnico ha interventi collegati.'})
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        with transaction.atomic():
            instance = super().update(instance, validated_data)
            if password:
                instance.set_password(password)
                instance.save(update_fields=['password'])
            if password or not instance.is_active:
                instance.auth_sessions.filter(revoked_at__isnull=True).update(revoked_at=timezone.now())
        return instance


class TechnicianSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'phone', 'is_active']
        read_only_fields = fields


class AuthSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuthSession
        fields = ['id', 'kind', 'created_at', 'expires_at', 'revoked_at']
        read_only_fields = fields


class WebLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = self.context['request'].user
        if not user.check_password(attrs['old_password']):
            raise serializers.ValidationError({'old_password': 'Password errata.'})
        password_validation.validate_password(attrs['new_password'], user)
        return attrs


class ResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True)
