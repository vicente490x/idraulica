from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from accounts.models import User
from .models import Intervention, StatusHistory, Availability, CompanySettings, AuditLog
from .services import ACTIVE, lock_technicians
from .exceptions import Conflict


class IsOffice(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in {User.Role.ADMIN, User.Role.OFFICE}


def company_zone():
    name = CompanySettings.objects.filter(pk=1).values_list('timezone', flat=True).first() or 'Europe/Rome'
    try:
        return ZoneInfo(name)
    except ZoneInfoNotFoundError:
        return ZoneInfo('Europe/Rome')


class DayQuerySerializer(serializers.Serializer):
    date = serializers.DateField(required=False)


class OverviewSerializer(serializers.Serializer):
    timezone = serializers.CharField()
    date = serializers.DateField()
    counts = serializers.DictField(child=serializers.IntegerField())
    technicians = serializers.ListField(child=serializers.DictField())
    recent = serializers.ListField(child=serializers.DictField())


class OverviewView(GenericAPIView):
    permission_classes = [IsOffice]
    serializer_class = OverviewSerializer

    @extend_schema(parameters=[DayQuerySerializer], responses=OverviewSerializer)
    def get(self, request):
        params = DayQuerySerializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        zone = company_zone()
        day = params.validated_data.get('date', timezone.localdate(timezone=zone))
        start = datetime.combine(day, time.min, tzinfo=zone)
        end = datetime.combine(day + timedelta(days=1), time.min, tzinfo=zone)
        week_start = datetime.combine(day - timedelta(days=day.weekday()), time.min, tzinfo=zone)
        week_end = week_start + timedelta(days=7)
        jobs = Intervention.objects.filter(starts_at__lt=end, ends_at__gt=start)
        counts = {key: jobs.filter(status=key).count() for key in Intervention.Status.values}
        counts.update(total=jobs.count(), urgent=jobs.filter(priority='urgent').exclude(status__in=['completed', 'cancelled']).count())
        counts['pending'] = sum(counts[s] for s in ['scheduled', 'assigned', 'confirmed', 'absent', 'reschedule'])
        now = timezone.now()
        busy_ids = set(Intervention.objects.filter(status__in=ACTIVE, starts_at__lte=now, ends_at__gt=now).values_list('technician_id', flat=True))
        unavailable_ids = set(Availability.objects.filter(available=False, starts_at__lte=now, ends_at__gt=now).values_list('technician_id', flat=True))
        week_jobs = list(Intervention.objects.filter(starts_at__lt=week_end, ends_at__gt=week_start).exclude(status='cancelled'))
        unavailable = list(Availability.objects.filter(available=False, starts_at__lt=end, ends_at__gt=start))
        technicians = []
        for tech in User.objects.filter(role='technician').order_by('first_name', 'id'):
            own_week = [j for j in week_jobs if j.technician_id == tech.pk]
            own_day = [j for j in own_week if j.starts_at < end and j.ends_at > start]
            absences = [a for a in unavailable if a.technician_id == tech.pk]
            busy = tech.pk in busy_ids
            off = tech.pk in unavailable_ids
            def hours(items, begin, finish):
                return round(sum((min(j.ends_at, finish) - max(j.starts_at, begin)).total_seconds() for j in items) / 3600, 2)
            technicians.append({'id': tech.pk, 'day_count': len(own_day), 'week_count': len(own_week), 'day_hours': hours(own_day, start, end), 'week_hours': hours(own_week, week_start, week_end), 'available_now': tech.is_active and not busy and not off, 'unavailable_today': bool(absences)})
        counts['available_technicians'] = sum(t['available_now'] for t in technicians)
        recent = [{'id': str(h.pk), 'intervention_id': str(h.intervention_id), 'title': h.intervention.title, 'status': h.new_status, 'created_at': h.created_at.isoformat()} for h in StatusHistory.objects.select_related('intervention').order_by('-created_at')[:8]]
        return Response({'date': day.isoformat(), 'timezone': str(zone), 'counts': counts, 'technicians': technicians, 'recent': recent})


class OfficeConfigSerializer(serializers.Serializer):
    timezone = serializers.CharField()


class OfficeConfigView(GenericAPIView):
    permission_classes = [IsOffice]
    serializer_class = OfficeConfigSerializer

    def get(self, request):
        return Response({'timezone': str(company_zone())})


class AvailabilitySerializer(serializers.ModelSerializer):
    technician = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(role='technician', is_active=True))

    class Meta:
        model = Availability
        fields = ['id', 'technician', 'starts_at', 'ends_at', 'available', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate(self, attrs):
        if attrs['ends_at'] <= attrs['starts_at']:
            raise serializers.ValidationError({'ends_at': 'La fine deve essere successiva all’inizio.'})
        if attrs.get('available', False):
            raise serializers.ValidationError({'available': 'Usare la rimozione dell’indisponibilità per liberare un intervallo.'})
        attrs['available'] = False
        return attrs


class AvailabilityViewSet(viewsets.ModelViewSet):
    queryset = Availability.objects.filter(available=False).order_by('starts_at')
    permission_classes = [IsOffice]
    serializer_class = AvailabilitySerializer
    http_method_names = ['get', 'post', 'delete', 'head', 'options']
    filterset_fields = ['technician']

    def perform_create(self, serializer):
        data = serializer.validated_data
        with transaction.atomic():
            lock_technicians([data['technician'].pk])
            if Intervention.objects.filter(technician=data['technician'], status__in=ACTIVE, starts_at__lt=data['ends_at'], ends_at__gt=data['starts_at']).exists():
                raise Conflict('Sono già presenti interventi in questo intervallo.')
            obj = serializer.save()
            AuditLog.objects.create(actor=self.request.user, action='availability.create', entity_id=str(obj.pk))

    def perform_destroy(self, instance):
        with transaction.atomic():
            lock_technicians([instance.technician_id])
            AuditLog.objects.create(actor=self.request.user, action='availability.delete', entity_id=str(instance.pk))
            instance.delete()
