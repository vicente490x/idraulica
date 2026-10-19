import uuid
from datetime import timedelta
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.test import APITestCase
from accounts.models import User
from operations.models import Customer, Intervention, StatusHistory, AuditLog, Availability


class OperationsTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.office = User.objects.create_user('office@example.invalid', role='office')
        self.tech = User.objects.create_user('tech@example.invalid')
        self.other = User.objects.create_user('other@example.invalid')
        self.client.force_authenticate(self.office)
        self.customer = Customer.objects.create(first_name='Cliente', last_name_or_company='Fittizio', phone='000000000', address='Via Demo 1', city='Roma', postal_code='00100', notes='Riservato ufficio')
        self.start = timezone.now() + timedelta(days=1)

    def payload(self, **changes):
        return {'customer': str(self.customer.pk), 'technician': self.tech.pk, 'title': 'Perdita dimostrativa', 'description': 'Riparazione tubo', 'intervention_type': 'riparazione', 'starts_at': self.start.isoformat(), 'ends_at': (self.start + timedelta(hours=1)).isoformat(), 'address': 'Via Demo 1', 'office_notes': 'Riservato', **changes}

    def create_job(self, **changes):
        response = self.client.post('/api/v1/interventions/', self.payload(**changes))
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def transition(self, job, target, **changes):
        response = self.client.post(f"/api/v1/interventions/{job['id']}/status/", {'status': target, 'version': job['version'], 'operation_id': str(uuid.uuid4()), **changes})
        if response.status_code == 200:
            job.update(response.data)
        return response

    def test_customer_crud_search_and_protected_delete(self):
        data = {'first_name': 'Azienda', 'last_name_or_company': 'Demo', 'phone': '000123', 'email': '', 'address': 'Via Test 2', 'city': 'Bari', 'postal_code': '70100'}
        created = self.client.post('/api/v1/customers/', data)
        self.assertEqual(created.status_code, 201, created.data)
        endpoint = f"/api/v1/customers/{created.data['id']}/"
        self.assertEqual(self.client.patch(endpoint, {'phone': '000456'}).status_code, 200)
        self.assertEqual(self.client.get('/api/v1/customers/?search=Demo&city=Bari').data['count'], 1)
        self.assertEqual(self.client.delete(endpoint).status_code, 204)
        self.create_job()
        self.assertEqual(self.client.delete(f'/api/v1/customers/{self.customer.pk}/').status_code, 409)
        self.assertEqual(AuditLog.objects.filter(action='customer.delete').count(), 1)

    def test_customer_coordinates_validation(self):
        endpoint = f'/api/v1/customers/{self.customer.pk}/'
        self.assertEqual(self.client.patch(endpoint, {'latitude': '45'}).status_code, 400)
        self.assertEqual(self.client.patch(endpoint, {'latitude': '91', 'longitude': '10'}).status_code, 400)
        self.assertEqual(self.client.patch(endpoint, {'latitude': '45', 'longitude': '10'}).status_code, 200)

    def test_technician_sees_only_own_interventions_customers_and_no_office_notes(self):
        own = self.create_job()
        other = self.create_job(technician=self.other.pk)
        self.client.force_authenticate(self.tech)
        result = self.client.get('/api/v1/interventions/').data
        self.assertEqual(result['count'], 1)
        self.assertNotIn('office_notes', result['results'][0])
        self.assertEqual(self.client.get(f"/api/v1/interventions/{other['id']}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/v1/interventions/{other['id']}/history/").status_code, 404)
        self.assertEqual(self.transition(other, 'confirmed').status_code, 404)
        self.assertEqual(self.client.patch(f"/api/v1/interventions/{own['id']}/", {'version': 1, 'title': 'x'}).status_code, 403)
        self.assertEqual(self.client.post('/api/v1/customers/', {}).status_code, 403)
        self.assertNotIn('notes', self.client.get(f'/api/v1/customers/{self.customer.pk}/').data)
        invisible = Customer.objects.create(first_name='Altro', last_name_or_company='Non assegnato', phone='0', address='X', city='X', postal_code='0')
        self.assertEqual(self.client.get(f'/api/v1/customers/{invisible.pk}/').status_code, 404)
        self.assertEqual(self.client.get('/api/v1/technicians/').data['count'], 1)

    def test_assignment_and_office_versioned_update(self):
        job = self.create_job(technician=None)
        self.assertEqual(job['status'], 'scheduled')
        endpoint = f"/api/v1/interventions/{job['id']}/"
        response = self.client.patch(endpoint, {'version': 1, 'technician': self.tech.pk})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'assigned')
        self.assertEqual(response.data['version'], 2)
        self.assertEqual(self.client.patch(endpoint, {'version': 1, 'title': 'stale'}).status_code, 409)
        self.assertEqual(self.client.patch(endpoint, {'title': 'missing version'}).status_code, 400)
        self.assertEqual(self.client.patch(endpoint, {'version': 2, 'status': 'completed'}).status_code, 400)
        self.assertEqual(StatusHistory.objects.count(), 2)

    def test_overlap_adjacent_intervals_and_inactive_technician(self):
        self.create_job()
        overlap = self.client.post('/api/v1/interventions/', self.payload(priority='urgent'))
        self.assertEqual(overlap.status_code, 409)
        self.create_job(starts_at=(self.start + timedelta(hours=1)).isoformat(), ends_at=(self.start + timedelta(hours=2)).isoformat())
        self.other.is_active = False
        self.other.save()
        self.assertEqual(self.client.post('/api/v1/interventions/', self.payload(technician=self.other.pk)).status_code, 400)
        self.assertEqual(self.client.post('/api/v1/interventions/', self.payload(technician=self.office.pk)).status_code, 400)

    def test_unavailability_and_invalid_duration(self):
        Availability.objects.create(technician=self.tech, starts_at=self.start, ends_at=self.start + timedelta(hours=2), available=False)
        self.assertEqual(self.client.post('/api/v1/interventions/', self.payload()).status_code, 409)
        self.assertEqual(self.client.post('/api/v1/interventions/', self.payload(technician=None, ends_at=self.start.isoformat())).status_code, 400)

    def test_full_phase2_status_flow_and_terminal_immutability(self):
        job = self.create_job()
        self.client.force_authenticate(self.tech)
        for target in ['confirmed', 'travelling', 'working', 'completed']:
            self.assertEqual(self.transition(job, target).status_code, 200)
        history = self.client.get(f"/api/v1/interventions/{job['id']}/history/").data['results']
        self.assertEqual([h['new_status'] for h in history], ['assigned', 'confirmed', 'travelling', 'working', 'completed'])
        self.assertEqual(self.transition(job, 'working').status_code, 400)
        self.client.force_authenticate(self.office)
        self.assertEqual(self.client.patch(f"/api/v1/interventions/{job['id']}/", {'version': job['version'], 'title': 'rewrite'}).status_code, 409)
        self.assertEqual(self.client.delete(f"/api/v1/interventions/{job['id']}/").status_code, 405)

    def test_absent_reschedule_and_cancel_permissions(self):
        job = self.create_job()
        self.client.force_authenticate(self.tech)
        self.assertEqual(self.transition(job, 'completed').status_code, 400)
        self.assertEqual(self.transition(job, 'cancelled').status_code, 403)
        self.assertEqual(self.transition(job, 'confirmed').status_code, 200)
        self.assertEqual(self.transition(job, 'absent', technician_notes='Cliente assente').status_code, 200)
        self.assertEqual(self.transition(job, 'reschedule').status_code, 403)
        self.client.force_authenticate(self.office)
        self.assertEqual(self.transition(job, 'reschedule').status_code, 200)
        self.assertEqual(self.transition(job, 'assigned').status_code, 200)
        self.assertEqual(self.transition(job, 'cancelled').status_code, 200)

    def test_idempotent_status_and_payload_mismatch(self):
        job = self.create_job()
        self.client.force_authenticate(self.tech)
        endpoint = f"/api/v1/interventions/{job['id']}/status/"
        data = {'version': 1, 'status': 'confirmed', 'operation_id': str(uuid.uuid4())}
        first = self.client.post(endpoint, data)
        second = self.client.post(endpoint, data)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.data, second.data)
        self.assertEqual(StatusHistory.objects.count(), 2)
        self.assertEqual(self.client.post(endpoint, {**data, 'status': 'travelling'}).status_code, 409)
        self.assertEqual(self.client.post(endpoint, {**data, 'operation_id': str(uuid.uuid4())}).status_code, 409)

    def test_reassignment_removes_previous_technician_access(self):
        job = self.create_job()
        self.assertEqual(self.client.patch(f"/api/v1/interventions/{job['id']}/", {'version': 1, 'technician': self.other.pk}).status_code, 200)
        self.client.force_authenticate(self.tech)
        self.assertEqual(self.client.get(f"/api/v1/interventions/{job['id']}/").status_code, 404)
        self.assertEqual(self.client.get(f'/api/v1/customers/{self.customer.pk}/').status_code, 404)

    def test_filters_and_error_envelope(self):
        self.create_job(priority='urgent')
        self.assertEqual(self.client.get('/api/v1/interventions/?priority=urgent&status=assigned&search=tubo').data['count'], 1)
        response = self.client.get('/api/v1/interventions/not-a-uuid/')
        self.assertEqual(response.status_code, 404)
        self.assertIn('error', response.data)

    def test_database_duration_constraint(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Intervention.objects.create(customer=self.customer, title='Invalid', starts_at=self.start, ends_at=self.start, address='X')
