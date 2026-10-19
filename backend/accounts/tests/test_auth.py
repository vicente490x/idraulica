from django.core import mail
from django.core.cache import cache
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.test import override_settings
from rest_framework.test import APITestCase, APIClient
from accounts.models import User, AuthSession

PASSWORD = 'Fiume-viola-6284!'


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class AuthenticationTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user('tecnico@example.invalid', PASSWORD, first_name='Demo')

    def login(self):
        response = self.client.post('/api/v1/auth/login/', {'email': self.user.email, 'password': PASSWORD})
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def authorize(self, tokens):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + tokens['access'])

    def test_login_case_insensitive_and_invalid_credentials(self):
        response = self.client.post('/api/v1/auth/login/', {'email': self.user.email.upper(), 'password': PASSWORD})
        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(self.user.password, PASSWORD)
        self.assertTrue(self.user.password.startswith('argon2'))
        self.assertEqual(self.client.post('/api/v1/auth/login/', {'email': self.user.email, 'password': 'wrong'}).status_code, 401)

    def test_anonymous_denied(self):
        for endpoint in ['customers/', 'interventions/', 'users/', 'auth/me/', 'schema/']:
            with self.subTest(endpoint=endpoint):
                self.assertEqual(self.client.get('/api/v1/' + endpoint).status_code, 401)

    def test_refresh_rotates_rejects_reuse_and_logout_revokes_access(self):
        tokens = self.login()
        rotated = self.client.post('/api/v1/auth/refresh/', {'refresh': tokens['refresh']})
        self.assertEqual(rotated.status_code, 200, rotated.data)
        self.assertNotEqual(rotated.data['refresh'], tokens['refresh'])
        self.assertEqual(self.client.post('/api/v1/auth/refresh/', {'refresh': tokens['refresh']}).status_code, 401)
        self.authorize(rotated.data)
        self.assertEqual(self.client.post('/api/v1/auth/logout/').status_code, 204)
        self.assertEqual(self.client.get('/api/v1/auth/me/').status_code, 401)
        self.client.credentials()
        self.assertEqual(self.client.post('/api/v1/auth/refresh/', {'refresh': rotated.data['refresh']}).status_code, 401)

    def test_disabled_account_cannot_use_access_or_refresh(self):
        tokens = self.login()
        self.user.is_active = False
        self.user.save()
        self.authorize(tokens)
        self.assertEqual(self.client.get('/api/v1/auth/me/').status_code, 401)
        self.client.credentials()
        self.assertEqual(self.client.post('/api/v1/auth/refresh/', {'refresh': tokens['refresh']}).status_code, 401)

    def test_session_list_and_revocation_is_scoped(self):
        tokens = self.login()
        self.authorize(tokens)
        sessions = self.client.get('/api/v1/auth/sessions/').data['results']
        self.assertEqual(len(sessions), 1)
        other = User.objects.create_user('other@example.invalid', PASSWORD)
        session = AuthSession.objects.create(user=other, kind='jwt', expires_at=AuthSession.objects.first().expires_at)
        self.assertEqual(self.client.post(f'/api/v1/auth/sessions/{session.pk}/revoke/').status_code, 404)
        self.assertEqual(self.client.post(f"/api/v1/auth/sessions/{sessions[0]['id']}/revoke/").status_code, 204)
        self.assertEqual(self.client.get('/api/v1/auth/me/').status_code, 401)

    def test_password_change_validates_and_revokes_all_sessions(self):
        first, second = self.login(), self.login()
        self.authorize(first)
        self.assertEqual(self.client.post('/api/v1/auth/password/change/', {'old_password': PASSWORD, 'new_password': '123'}).status_code, 400)
        self.assertEqual(self.client.post('/api/v1/auth/password/change/', {'old_password': PASSWORD, 'new_password': 'Lago-giallo-8642!'}).status_code, 204)
        self.authorize(second)
        self.assertEqual(self.client.get('/api/v1/auth/me/').status_code, 401)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('Lago-giallo-8642!'))

    def test_password_reset_is_uniform_single_use_and_revokes_sessions(self):
        tokens = self.login()
        found = self.client.post('/api/v1/auth/password/reset/', {'email': self.user.email})
        missing = self.client.post('/api/v1/auth/password/reset/', {'email': 'missing@example.invalid'})
        self.assertEqual(found.data, missing.data)
        self.assertEqual(len(mail.outbox), 1)
        self.user.refresh_from_db()
        data = {'uid': urlsafe_base64_encode(force_bytes(self.user.pk)), 'token': default_token_generator.make_token(self.user), 'new_password': 'Montagna-rossa-8739!'}
        response = self.client.post('/api/v1/auth/password/reset/confirm/', data)
        self.assertEqual(response.status_code, 204, response.data)
        self.assertEqual(self.client.post('/api/v1/auth/password/reset/confirm/', data).status_code, 400)
        self.authorize(tokens)
        self.assertEqual(self.client.get('/api/v1/auth/me/').status_code, 401)

    def test_login_rate_limit(self):
        statuses = [self.client.post('/api/v1/auth/login/', {'email': self.user.email, 'password': 'invalid'}).status_code for _ in range(11)]
        self.assertEqual(statuses[-1], 429)

    def test_web_login_and_mutations_require_csrf(self):
        client = APIClient(enforce_csrf_checks=True)
        data = {'email': self.user.email, 'password': PASSWORD}
        self.assertEqual(client.post('/api/v1/auth/web-login/', data).status_code, 403)
        token = client.get('/api/v1/auth/csrf/').data['csrfToken']
        self.assertEqual(client.post('/api/v1/auth/web-login/', data, HTTP_X_CSRFTOKEN=token).status_code, 200)
        self.assertTrue(client.cookies['sessionid']['httponly'])
        self.assertEqual(client.get('/api/v1/auth/me/').status_code, 200)
        self.assertEqual(client.post('/api/v1/auth/logout/').status_code, 403)
        token = client.get('/api/v1/auth/csrf/').data['csrfToken']
        self.assertEqual(client.post('/api/v1/auth/logout/', HTTP_X_CSRFTOKEN=token).status_code, 204)
        self.assertEqual(client.get('/api/v1/auth/me/').status_code, 401)

    def test_user_administration_and_duplicate_email(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get('/api/v1/users/').status_code, 403)
        self.user.role = User.Role.OFFICE
        self.user.save()
        self.assertEqual(self.client.post('/api/v1/users/', {}).status_code, 403)
        self.user.role = User.Role.ADMIN
        self.user.save()
        data = {'email': 'new@example.invalid', 'password': PASSWORD, 'role': 'office'}
        self.assertEqual(self.client.post('/api/v1/users/', data).status_code, 201)
        data['email'] = data['email'].upper()
        self.assertEqual(self.client.post('/api/v1/users/', data).status_code, 400)
