from django.utils import timezone
from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import AuthSession


def active_session(session_id, user_id, kind):
    return AuthSession.objects.filter(pk=session_id, user_id=user_id, kind=kind, revoked_at__isnull=True, expires_at__gt=timezone.now()).exists()


class SessionJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        try:
            valid = active_session(validated_token.get('sid'), user.pk, 'jwt')
        except (ValueError, TypeError):
            valid = False
        if not valid:
            raise AuthenticationFailed('Sessione scaduta o revocata.')
        return user


class ManagedSessionAuthentication(SessionAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result:
            user, _ = result
            if not active_session(request.session.get('auth_session_id'), user.pk, 'web'):
                raise AuthenticationFailed('Sessione scaduta o revocata.')
        return result


class JWTAuthSchema(OpenApiAuthenticationExtension):
    target_class = SessionJWTAuthentication
    name = 'jwtAuth'

    def get_security_definition(self, auto_schema):
        return {'type': 'http', 'scheme': 'bearer', 'bearerFormat': 'JWT'}


class WebAuthSchema(OpenApiAuthenticationExtension):
    target_class = ManagedSessionAuthentication
    name = 'cookieAuth'

    def get_security_definition(self, auto_schema):
        return {'type': 'apiKey', 'in': 'cookie', 'name': 'sessionid'}
