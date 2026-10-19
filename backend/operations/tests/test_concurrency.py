from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from unittest import skipUnless
import uuid
from django.db import connection, close_old_connections, connections
from django.test import TransactionTestCase
from django.utils import timezone
from accounts.models import User
from operations.exceptions import Conflict
from operations.models import Customer, Intervention, StatusHistory, SyncOperation
from operations.services import create_intervention, update_intervention, change_status


@skipUnless(connection.vendor == 'postgresql', 'Richiede i lock reali di PostgreSQL.')
class PostgreSQLConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.office = User.objects.create_user('office@example.invalid', role='office')
        self.tech = User.objects.create_user('tech@example.invalid')
        self.customer = Customer.objects.create(first_name='Demo', last_name_or_company='Test', phone='0', address='X', city='X', postal_code='0')
        start = timezone.now() + timedelta(days=1)
        self.data = {'customer': self.customer, 'technician': self.tech, 'title': 'Concorrenza', 'description': 'Demo', 'intervention_type': 'test', 'starts_at': start, 'ends_at': start + timedelta(hours=1), 'address': 'X'}

    def concurrent(self, action):
        barrier = Barrier(2)

        def worker(index):
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                return action(index)
            except Conflict:
                return 'conflict'
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(worker, i) for i in range(2)]
            return [future.result(timeout=20) for future in futures]

    def test_parallel_assignments_cannot_overlap(self):
        def create(index):
            create_intervention(dict(self.data), User.objects.get(pk=self.office.pk))
            return 'created'
        self.assertCountEqual(self.concurrent(create), ['created', 'conflict'])
        self.assertEqual(Intervention.objects.count(), 1)

    def test_parallel_office_updates_detect_stale_version(self):
        job = create_intervention(dict(self.data), self.office)

        def update(index):
            update_intervention(Intervention.objects.get(pk=job.pk), {'version': 1, 'title': str(index)}, self.office)
            return 'updated'
        self.assertCountEqual(self.concurrent(update), ['updated', 'conflict'])
        job.refresh_from_db()
        self.assertEqual(job.version, 2)

    def test_parallel_retries_create_one_status_history_entry(self):
        job = create_intervention(dict(self.data), self.office)
        payload = {'status': 'confirmed', 'version': 1, 'operation_id': uuid.uuid4()}

        def transition(index):
            return change_status(Intervention.objects.get(pk=job.pk), payload, self.tech)
        results = self.concurrent(transition)
        self.assertEqual(results[0], results[1])
        self.assertEqual(StatusHistory.objects.count(), 2)
        self.assertEqual(SyncOperation.objects.count(), 1)
