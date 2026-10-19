from datetime import timedelta
import uuid
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase
from accounts.models import User


class AuthenticatedWorkflowTest(APITestCase):
    def test_office_to_technician_and_back_using_real_jwt(self):
        cache.clear()
        password = 'Demo-test-only-6832!'
        admin = User.objects.create_superuser('admin@example.invalid', password)

        def login(email):
            self.client.credentials()
            response = self.client.post('/api/v1/auth/login/', {'email': email, 'password': password})
            self.assertEqual(response.status_code, 200, response.data)
            self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + response.data['access'])

        login(admin.email)
        users = {}
        for role in ['office', 'technician']:
            response = self.client.post('/api/v1/users/', {'email': role + '@example.invalid', 'password': password, 'role': role})
            self.assertEqual(response.status_code, 201, response.data)
            users[role] = response.data
        login(users['office']['email'])
        customer = self.client.post('/api/v1/customers/', {'first_name': 'Cliente', 'last_name_or_company': 'Fittizio', 'phone': '000000', 'address': 'Via Demo 1', 'city': 'Roma', 'postal_code': '00100'})
        self.assertEqual(customer.status_code, 201, customer.data)
        start = timezone.now() + timedelta(days=1)
        response = self.client.post('/api/v1/interventions/', {'customer': customer.data['id'], 'technician': users['technician']['id'], 'title': 'Perdita', 'description': 'Test integrato', 'intervention_type': 'riparazione', 'address': 'Via Demo 1', 'starts_at': start.isoformat(), 'ends_at': (start + timedelta(hours=1)).isoformat()})
        self.assertEqual(response.status_code, 201, response.data)
        job = response.data
        login(users['technician']['email'])
        agenda = self.client.get('/api/v1/interventions/').data['results']
        self.assertEqual(agenda[0]['id'], job['id'])
        for target in ['confirmed', 'travelling', 'working', 'completed']:
            response = self.client.post(f"/api/v1/interventions/{job['id']}/status/", {'status': target, 'version': job['version'], 'operation_id': str(uuid.uuid4())})
            self.assertEqual(response.status_code, 200, response.data)
            job.update(response.data)
        login(users['office']['email'])
        self.assertEqual(self.client.get(f"/api/v1/interventions/{job['id']}/").data['status'], 'completed')
        self.assertEqual(self.client.get(f"/api/v1/interventions/{job['id']}/history/").data['count'], 5)
