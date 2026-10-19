from datetime import datetime, timedelta, timezone as dt_timezone
from django.utils import timezone
from rest_framework.test import APITestCase
from accounts.models import User
from operations.models import Customer, Intervention, Availability, CompanySettings
from operations.services import create_intervention


class OfficeDashboardTests(APITestCase):
    def setUp(self):
        self.office=User.objects.create_user('office@example.invalid',role='office')
        self.tech=User.objects.create_user('tech@example.invalid')
        self.customer=Customer.objects.create(first_name='Demo',last_name_or_company='Test',phone='0',address='X',city='Roma',postal_code='0')
        self.client.force_authenticate(self.office)

    def job(self, start, end, **values):
        return create_intervention(dict(customer=self.customer,technician=self.tech,title='Test',description='Test',intervention_type='Test',starts_at=start,ends_at=end,address='X',**values),self.office)

    def test_overview_uses_local_day_and_cross_midnight_jobs(self):
        start=datetime(2026,10,19,22,30,tzinfo=dt_timezone.utc)
        self.job(start,start+timedelta(hours=2))
        response=self.client.get('/api/v1/office/overview/?date=2026-10-20')
        self.assertEqual(response.status_code,200,response.data)
        self.assertEqual(response.data['counts']['total'],1)
        self.assertEqual(response.data['technicians'][0]['day_hours'],2)
        self.assertEqual(response.data['timezone'],'Europe/Rome')

    def test_temporal_filter_is_half_open_overlap(self):
        start=datetime(2026,10,19,22,30,tzinfo=dt_timezone.utc)
        self.job(start,start+timedelta(hours=2))
        self.assertEqual(self.client.get('/api/v1/interventions/?start=2026-10-20T00:00:00Z&end=2026-10-20T01:00:00Z').data['count'],1)
        self.assertEqual(self.client.get('/api/v1/interventions/?start=2026-10-20T00:30:00Z&end=2026-10-20T01:00:00Z').data['count'],0)
        self.assertEqual(self.client.get('/api/v1/interventions/?start=invalid').status_code,400)

    def test_overview_validation_and_technician_denied(self):
        self.assertEqual(self.client.get('/api/v1/office/overview/?date=no').status_code,400)
        self.client.force_authenticate(self.tech)
        for path in ['office/overview/','office/config/','availability/']:
            self.assertEqual(self.client.get('/api/v1/'+path).status_code,403)

    def test_availability_rejects_existing_jobs_and_blocks_new_assignments(self):
        start=timezone.now()+timedelta(days=1)
        data={'technician':self.tech.pk,'starts_at':start.isoformat(),'ends_at':(start+timedelta(hours=2)).isoformat(),'available':False}
        response=self.client.post('/api/v1/availability/',data)
        self.assertEqual(response.status_code,201,response.data)
        self.assertEqual(self.client.post('/api/v1/interventions/',{'customer':str(self.customer.pk),'technician':self.tech.pk,'title':'Test','description':'Test','intervention_type':'Test','address':'X','starts_at':start.isoformat(),'ends_at':(start+timedelta(hours=1)).isoformat()}).status_code,409)
        self.assertEqual(self.client.delete(f"/api/v1/availability/{response.data['id']}/").status_code,204)
        self.job(start,start+timedelta(hours=1))
        self.assertEqual(self.client.post('/api/v1/availability/',data).status_code,409)
        self.assertEqual(Availability.objects.count(),0)

    def test_invalid_availability_and_non_technician_rejected(self):
        start=timezone.now()
        data={'technician':self.tech.pk,'starts_at':start.isoformat(),'ends_at':start.isoformat(),'available':False}
        self.assertEqual(self.client.post('/api/v1/availability/',data).status_code,400)
        data.update(ends_at=(start+timedelta(hours=1)).isoformat(),technician=self.office.pk)
        self.assertEqual(self.client.post('/api/v1/availability/',data).status_code,400)

    def test_current_availability_independent_from_selected_day(self):
        now=timezone.now()
        self.job(now-timedelta(minutes=10),now+timedelta(minutes=50))
        response=self.client.get('/api/v1/office/overview/?date=2027-01-01')
        self.assertFalse(response.data['technicians'][0]['available_now'])
        self.assertEqual(response.data['counts']['available_technicians'],0)

    def test_company_timezone_and_dst_day_hours(self):
        CompanySettings.objects.create(timezone='Europe/Rome')
        start=datetime(2026,10,24,22,tzinfo=dt_timezone.utc)
        self.job(start,start+timedelta(hours=25))
        result=self.client.get('/api/v1/office/overview/?date=2026-10-25').data
        self.assertEqual(result['technicians'][0]['day_hours'],25)
        self.assertEqual(self.client.get('/api/v1/office/config/').data['timezone'],'Europe/Rome')

    def test_server_exposes_labels_and_allowed_transitions(self):
        start=timezone.now()+timedelta(days=1)
        job=self.job(start,start+timedelta(hours=1))
        response=self.client.get(f'/api/v1/interventions/{job.pk}/')
        self.assertEqual(response.data['customer_name'],'Demo Test')
        self.assertIn('cancelled',response.data['allowed_transitions'])
        self.client.force_authenticate(self.tech)
        response=self.client.get(f'/api/v1/interventions/{job.pk}/')
        self.assertEqual(response.data['allowed_transitions'],['confirmed'])
