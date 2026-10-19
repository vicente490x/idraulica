"""Server E2E isolato. Account fittizi solo nel database temporaneo di questo processo."""
import os
from pathlib import Path
import sys
import tempfile
from datetime import timedelta

root=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(root/'backend'))
temp=tempfile.TemporaryDirectory(prefix='hydro-browser-tests-')
os.environ.update(DJANGO_SETTINGS_MODULE='config.settings', APP_ENV='test', DB_ENGINE='sqlite', SQLITE_DB_PATH=str(Path(temp.name)/'browser.sqlite3'), CSRF_TRUSTED_ORIGINS='http://127.0.0.1:3001', REDIS_URL='')
import django
django.setup()
from django.core.management import call_command
from django.utils import timezone
from accounts.models import User
from operations.models import Customer
from operations.services import create_intervention

call_command('migrate',verbosity=0,interactive=False)
office=User.objects.create_user('office@example.invalid','Office-browser-test-4628!',role='office',first_name='Lucia',last_name='Demo')
User.objects.create_superuser('admin@example.invalid','Office-browser-test-4628!',first_name='Admin',last_name='Demo')
tech=User.objects.create_user('tech@example.invalid','Office-browser-test-4628!',first_name='Marco',last_name='Demo',phone='000000000')
User.objects.create_user('tech2@example.invalid','Office-browser-test-4628!',first_name='Sara',last_name='Demo')
customer=Customer.objects.create(first_name='Cliente',last_name_or_company='Esempio',phone='000000000',email='cliente@example.invalid',address='Via Dimostrativa 1',city='Roma',postal_code='00100')
now=timezone.now()
create_intervention(dict(customer=customer,technician=tech,title='Manutenzione di prova',description='Solo dati fittizi per test automatici',intervention_type='Manutenzione',starts_at=now-timedelta(minutes=15),ends_at=now+timedelta(minutes=45),address=customer.address),office)
try:
    call_command('runserver','127.0.0.1:8001',use_reloader=False,verbosity=0)
finally:
    temp.cleanup()
