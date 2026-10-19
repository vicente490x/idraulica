import hashlib
import json
from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError
from accounts.models import User
from .exceptions import Conflict
from .models import Intervention, StatusHistory, AuditLog, SyncOperation, Availability

S = Intervention.Status
ACTIVE = [S.ASSIGNED, S.CONFIRMED, S.TRAVELLING, S.WORKING]
TRANSITIONS = {
    S.SCHEDULED: {S.ASSIGNED, S.CANCELLED},
    S.ASSIGNED: {S.CONFIRMED, S.RESCHEDULE, S.CANCELLED},
    S.CONFIRMED: {S.TRAVELLING, S.ABSENT, S.RESCHEDULE, S.CANCELLED},
    S.TRAVELLING: {S.WORKING, S.ABSENT, S.CANCELLED},
    S.WORKING: {S.COMPLETED, S.ABSENT, S.CANCELLED},
    S.ABSENT: {S.RESCHEDULE, S.CANCELLED},
    S.RESCHEDULE: {S.ASSIGNED, S.CANCELLED},
    S.COMPLETED: set(), S.CANCELLED: set(),
}
TECHNICIAN_TARGETS = {S.CONFIRMED, S.TRAVELLING, S.WORKING, S.COMPLETED, S.ABSENT}


def lock_technicians(ids):
    # Stable ordering prevents opposite reassignments from deadlocking.
    list(User.objects.select_for_update().filter(pk__in=[i for i in ids if i]).order_by('pk'))


def validate_schedule(obj):
    if obj.ends_at <= obj.starts_at:
        raise ValidationError({'ends_at': 'La fine deve essere successiva all’inizio.'})
    if obj.technician_id:
        tech = User.objects.get(pk=obj.technician_id)
        if tech.role != User.Role.TECHNICIAN or not tech.is_active:
            raise ValidationError({'technician': 'Selezionare un tecnico attivo.'})
    if obj.status in ACTIVE:
        if not obj.technician_id:
            raise ValidationError({'technician': 'Tecnico obbligatorio.'})
        overlap = Intervention.objects.filter(technician_id=obj.technician_id, status__in=ACTIVE, starts_at__lt=obj.ends_at, ends_at__gt=obj.starts_at).exclude(pk=obj.pk)
        if overlap.exists():
            raise Conflict('Il tecnico ha un intervento sovrapposto.')
        if Availability.objects.filter(technician_id=obj.technician_id, available=False, starts_at__lt=obj.ends_at, ends_at__gt=obj.starts_at).exists():
            raise Conflict('Il tecnico non è disponibile nell’intervallo richiesto.')


def record_change(obj, actor, previous, action):
    if previous != obj.status:
        StatusHistory.objects.create(intervention=obj, actor=actor, previous_status=previous, new_status=obj.status)
    AuditLog.objects.create(actor=actor, action=action, entity_id=str(obj.pk), metadata={'version': obj.version})


@transaction.atomic
def create_intervention(data, actor):
    lock_technicians([getattr(data.get('technician'), 'pk', None)])
    obj = Intervention(**data)
    obj.status = S.ASSIGNED if obj.technician_id else S.SCHEDULED
    validate_schedule(obj)
    obj.save()
    record_change(obj, actor, '', 'intervention.create')
    return obj


def lock_intervention(instance, new_technician_id=None):
    # Snapshot may go stale while obtaining locks. A competing reassignment is retried by client.
    old_id = instance.technician_id
    lock_technicians([old_id, new_technician_id])
    obj = Intervention.objects.select_for_update().get(pk=instance.pk)
    if obj.technician_id != old_id:
        raise Conflict()
    return obj


@transaction.atomic
def update_intervention(instance, data, actor):
    obj = lock_intervention(instance, getattr(data.get('technician'), 'pk', None))
    expected = data.pop('version')
    if obj.version != expected:
        raise Conflict()
    if obj.status in {S.COMPLETED, S.CANCELLED}:
        raise Conflict('Intervento concluso: modifica non consentita.')
    previous = obj.status
    scheduling_fields = {'technician', 'starts_at', 'ends_at', 'customer', 'address'}
    if obj.status in {S.TRAVELLING, S.WORKING, S.ABSENT} and scheduling_fields.intersection(data):
        raise Conflict('La pianificazione non è modificabile nello stato attuale.')
    for key, value in data.items():
        setattr(obj, key, value)
    if 'technician' in data:
        if obj.status in {S.SCHEDULED, S.ASSIGNED, S.CONFIRMED}:
            obj.status = S.ASSIGNED if obj.technician_id else S.SCHEDULED
    validate_schedule(obj)
    obj.version += 1
    obj.save()
    record_change(obj, actor, previous, 'intervention.update')
    return obj


@transaction.atomic
def change_status(instance, data, actor):
    # Serializes operation IDs for the same user, including retries on different jobs.
    User.objects.select_for_update().get(pk=actor.pk)
    obj = lock_intervention(instance)
    if actor.role == User.Role.TECHNICIAN and obj.technician_id != actor.pk:
        raise PermissionDenied('Intervento non assegnato.')
    payload = {**data, 'intervention': str(obj.pk), 'operation_id': str(data['operation_id'])}
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    existing = SyncOperation.objects.filter(user=actor, operation_id=data['operation_id']).first()
    if existing:
        if existing.request_hash != digest:
            raise Conflict('Identificativo operazione già usato con dati differenti.')
        return existing.response
    if obj.version != data['version']:
        raise Conflict()
    target = data['status']
    if actor.role == User.Role.TECHNICIAN and target not in TECHNICIAN_TARGETS:
        raise PermissionDenied('Transizione riservata all’ufficio.')
    if target not in TRANSITIONS[obj.status]:
        raise ValidationError({'status': 'Transizione di stato non consentita.'})
    previous = obj.status
    obj.status = target
    if 'technician_notes' in data:
        obj.technician_notes = data['technician_notes']
    validate_schedule(obj)
    obj.version += 1
    obj.save()
    record_change(obj, actor, previous, 'intervention.status')
    result = {'id': str(obj.pk), 'status': obj.status, 'version': obj.version}
    SyncOperation.objects.create(user=actor, operation_id=data['operation_id'], request_hash=digest, response=result)
    return result
