from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless
from django.core.cache import cache
from django.db import connection, close_old_connections, connections
from django.test import TransactionTestCase
from rest_framework.test import APIClient
from accounts.models import User


@skipUnless(connection.vendor == 'postgresql', 'Richiede PostgreSQL.')
class RefreshConcurrencyTests(TransactionTestCase):
    def test_parallel_refresh_rejects_duplicate(self):
        cache.clear()
        user = User.objects.create_user('refresh@example.invalid', 'Fiume-viola-6284!')
        response = APIClient().post('/api/v1/auth/login/', {'email': user.email, 'password': 'Fiume-viola-6284!'}, format='json')
        refresh = response.data['refresh']
        barrier = Barrier(2)

        def rotate():
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                return APIClient().post('/api/v1/auth/refresh/', {'refresh': refresh}, format='json').status_code
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = [pool.submit(rotate) for _ in range(2)]
            statuses = [result.result(timeout=20) for result in results]
        self.assertCountEqual(statuses, [200, 401])
