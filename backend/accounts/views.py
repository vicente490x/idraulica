from datetime import timedelta
from django.conf import settings
from django.contrib.auth import authenticate, login, logout, password_validation
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db import transaction
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.authentication import CSRFCheck
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from .models import User, AuthSession
from .serializers import (UserSerializer, TechnicianSerializer, AuthSessionSerializer, WebLoginSerializer,
                          PasswordChangeSerializer, ResetRequestSerializer, ResetConfirmSerializer)
from operations.permissions import IsAdmin
from operations.models import AuditLog


class LoginView(TokenObtainPairView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'


class RefreshView(TokenRefreshView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('id')
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]
    http_method_names = ['get', 'post', 'patch', 'put', 'head', 'options']
    search_fields = ['email', 'first_name', 'last_name']
    filterset_fields = ['role', 'is_active']
    ordering_fields = ['id', 'email', 'date_joined']

    def perform_create(self, serializer):
        with transaction.atomic():
            user = serializer.save()
            AuditLog.objects.create(actor=self.request.user, action='user.create', entity_id=str(user.pk))

    def perform_update(self, serializer):
        with transaction.atomic():
            user = serializer.save()
            AuditLog.objects.create(actor=self.request.user, action='user.update', entity_id=str(user.pk))


class TechnicianViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TechnicianSerializer
    queryset = User.objects.none()
    search_fields = ['first_name', 'last_name', 'phone']
    filterset_fields = ['is_active']

    def get_queryset(self):
        query = User.objects.filter(role=User.Role.TECHNICIAN).order_by('id')
        if self.request.user.role == User.Role.TECHNICIAN:
            query = query.filter(pk=self.request.user.pk)
        return query


class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class SessionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuthSessionSerializer
    queryset = AuthSession.objects.none()

    def get_queryset(self):
        return AuthSession.objects.filter(user=self.request.user).order_by('-created_at')

    @extend_schema(request=None, responses={204: None})
    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        session = self.get_object()
        session.revoked_at = timezone.now()
        session.save(update_fields=['revoked_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class LogoutView(APIView):
    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        sid = request.auth.get('sid') if request.auth else request.session.get('auth_session_id')
        AuthSession.objects.filter(pk=sid, user=request.user).update(revoked_at=timezone.now())
        logout(request)
        return Response(status=204)


class CSRFView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses=inline_serializer('CSRFToken', fields={'csrfToken': serializers.CharField()}))
    def get(self, request):
        return Response({'csrfToken': get_token(request)})


class WebLoginView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = WebLoginSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    @extend_schema(responses=UserSerializer)
    def post(self, request):
        check = CSRFCheck(lambda r: None)
        check.process_request(request)
        reason = check.process_view(request, None, (), {})
        if reason:
            raise PermissionDenied('Token CSRF mancante o non valido.')
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(request, email=serializer.validated_data['email'].strip().lower(), password=serializer.validated_data['password'])
        if not user:
            raise AuthenticationFailed('Credenziali non valide.')
        login(request, user)
        session = AuthSession.objects.create(user=user, kind='web', expires_at=timezone.now() + timedelta(seconds=settings.SESSION_COOKIE_AGE))
        request.session['auth_session_id'] = str(session.pk)
        return Response(UserSerializer(user).data)


class PasswordChangeView(generics.GenericAPIView):
    serializer_class = PasswordChangeSerializer

    @extend_schema(responses={204: None})
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=request.user.pk)
            user.set_password(serializer.validated_data['new_password'])
            user.save(update_fields=['password'])
            user.auth_sessions.filter(revoked_at__isnull=True).update(revoked_at=timezone.now())
        logout(request)
        return Response(status=204)


class ResetRequestView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = ResetRequestSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    @extend_schema(responses=inline_serializer('ResetAccepted', fields={'detail': serializers.CharField()}))
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(email__iexact=serializer.validated_data['email'], is_active=True).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            link = f'{settings.PASSWORD_RESET_URL}?uid={uid}&token={token}'
            send_mail('Recupero password gestionale', f'Per impostare una nuova password apri: {link}', settings.DEFAULT_FROM_EMAIL, [user.email])
        return Response({'detail': 'Se l’account esiste, riceverai le istruzioni.'})


class ResetConfirmView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = ResetConfirmSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    @extend_schema(responses={204: None})
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        with transaction.atomic():
            try:
                user = User.objects.select_for_update().get(pk=urlsafe_base64_decode(data['uid']).decode(), is_active=True)
            except (User.DoesNotExist, ValueError, TypeError, UnicodeError, OverflowError):
                raise ValidationError('Link non valido o scaduto.')
            if not default_token_generator.check_token(user, data['token']):
                raise ValidationError('Link non valido o scaduto.')
            try:
                password_validation.validate_password(data['new_password'], user)
            except DjangoValidationError as exc:
                raise ValidationError({'new_password': exc.messages})
            user.set_password(data['new_password'])
            user.save(update_fields=['password'])
            user.auth_sessions.filter(revoked_at__isnull=True).update(revoked_at=timezone.now())
        return Response(status=204)
