import uuid
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.db.models import Q, F

USER = settings.AUTH_USER_MODEL


class Record(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True


class Customer(Record):
    first_name = models.CharField(max_length=120)
    last_name_or_company = models.CharField(max_length=180)
    phone = models.CharField(max_length=32)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=255)
    city = models.CharField(max_length=120)
    postal_code = models.CharField(max_length=16)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, validators=[MinValueValidator(-90), MaxValueValidator(90)])
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, validators=[MinValueValidator(-180), MaxValueValidator(180)])
    notes = models.TextField(blank=True)

    class Meta:
        indexes = [models.Index(fields=['last_name_or_company', 'city'])]
        constraints = [
            models.CheckConstraint(condition=Q(latitude__isnull=True, longitude__isnull=True) | Q(latitude__isnull=False, longitude__isnull=False), name='customer_coordinate_pair'),
            models.CheckConstraint(condition=Q(latitude__isnull=True) | Q(latitude__gte=-90, latitude__lte=90), name='customer_lat_range'),
            models.CheckConstraint(condition=Q(longitude__isnull=True) | Q(longitude__gte=-180, longitude__lte=180), name='customer_lon_range'),
        ]


class Intervention(Record):
    class Status(models.TextChoices):
        SCHEDULED = 'scheduled', 'Programmato'
        ASSIGNED = 'assigned', 'Assegnato'
        CONFIRMED = 'confirmed', 'Confermato'
        TRAVELLING = 'travelling', 'In viaggio'
        WORKING = 'working', 'In lavorazione'
        COMPLETED = 'completed', 'Completato'
        ABSENT = 'absent', 'Cliente assente'
        CANCELLED = 'cancelled', 'Annullato'
        RESCHEDULE = 'reschedule', 'Da riprogrammare'

    class Priority(models.TextChoices):
        NORMAL = 'normal', 'Normale'
        HIGH = 'high', 'Alta'
        URGENT = 'urgent', 'Urgente'

    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='interventions')
    technician = models.ForeignKey(USER, on_delete=models.PROTECT, null=True, blank=True, related_name='interventions')
    title = models.CharField(max_length=180)
    description = models.TextField()
    intervention_type = models.CharField(max_length=80)
    priority = models.CharField(max_length=12, choices=Priority.choices, default=Priority.NORMAL)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    address = models.CharField(max_length=255)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.SCHEDULED)
    office_notes = models.TextField(blank=True)
    technician_notes = models.TextField(blank=True)
    version = models.PositiveIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=['technician', 'starts_at']), models.Index(fields=['status', 'starts_at'])]
        constraints = [
            models.CheckConstraint(condition=Q(ends_at__gt=F('starts_at')), name='intervention_positive_duration'),
            models.CheckConstraint(condition=Q(status__in=['scheduled', 'cancelled', 'reschedule']) | Q(technician__isnull=False), name='intervention_assigned_states'),
        ]


class StatusHistory(Record):
    intervention = models.ForeignKey(Intervention, on_delete=models.PROTECT, related_name='history')
    previous_status = models.CharField(max_length=16, blank=True)
    new_status = models.CharField(max_length=16, choices=Intervention.Status.choices)
    actor = models.ForeignKey(USER, on_delete=models.PROTECT)


class Photo(Record):
    intervention = models.ForeignKey(Intervention, on_delete=models.PROTECT, related_name='photos')
    kind = models.CharField(max_length=6, choices=[('before', 'Prima'), ('after', 'Dopo')])
    storage_key = models.CharField(max_length=512, unique=True)
    uploaded_by = models.ForeignKey(USER, on_delete=models.PROTECT)


class Signature(Record):
    intervention = models.ForeignKey(Intervention, on_delete=models.PROTECT, related_name='signatures')
    storage_key = models.CharField(max_length=512, unique=True)
    document_snapshot = models.JSONField()
    document_hash = models.CharField(max_length=64)
    document_id = models.UUIDField(default=uuid.uuid4, unique=True)
    signed_at = models.DateTimeField()


class Quote(Record):
    intervention = models.ForeignKey(Intervention, on_delete=models.PROTECT, related_name='quotes')
    description = models.TextField()
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=12, choices=[('draft', 'Bozza'), ('submitted', 'Inviato'), ('approved', 'Approvato'), ('rejected', 'Rifiutato')], default='draft')


class QuoteItem(models.Model):
    quote = models.ForeignKey(Quote, on_delete=models.CASCADE, related_name='items')
    description = models.CharField(max_length=255)
    kind = models.CharField(max_length=12, choices=[('material', 'Materiale'), ('labor', 'Manodopera')])
    quantity = models.DecimalField(max_digits=10, decimal_places=3)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2)

    class Meta:
        constraints = [models.CheckConstraint(condition=Q(quantity__gt=0, unit_price__gte=0, vat_rate__gte=0, vat_rate__lte=100), name='quote_item_valid_amounts')]


class Conversation(Record):
    participants = models.ManyToManyField(USER, related_name='conversations')
    intervention = models.ForeignKey(Intervention, on_delete=models.PROTECT, null=True, blank=True)


class Message(Record):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(USER, on_delete=models.PROTECT)
    content = models.TextField()


class MessageRead(models.Model):
    message = models.ForeignKey(Message, on_delete=models.CASCADE)
    user = models.ForeignKey(USER, on_delete=models.CASCADE)
    read_at = models.DateTimeField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=['message', 'user'], name='message_read_unique')]


class Notification(Record):
    recipient = models.ForeignKey(USER, on_delete=models.CASCADE, related_name='notifications')
    kind = models.CharField(max_length=40)
    content = models.CharField(max_length=255)
    read_at = models.DateTimeField(null=True, blank=True)
    deduplication_key = models.UUIDField(default=uuid.uuid4, unique=True)


class TechnicianLocation(Record):
    technician = models.ForeignKey(USER, on_delete=models.CASCADE)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    recorded_at = models.DateTimeField()
    work_authorized = models.BooleanField(default=False)

    class Meta:
        constraints = [models.CheckConstraint(condition=Q(latitude__gte=-90, latitude__lte=90, longitude__gte=-180, longitude__lte=180, work_authorized=True), name='location_authorized_valid')]


class Availability(Record):
    technician = models.ForeignKey(USER, on_delete=models.CASCADE, related_name='availability')
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    available = models.BooleanField(default=True)

    class Meta:
        constraints = [models.CheckConstraint(condition=Q(ends_at__gt=F('starts_at')), name='availability_positive_duration')]


class Device(Record):
    user = models.ForeignKey(USER, on_delete=models.CASCADE)
    token = models.CharField(max_length=512, unique=True)
    platform = models.CharField(max_length=10, choices=[('android', 'Android'), ('ios', 'iOS'), ('web', 'Web')])
    active = models.BooleanField(default=True)


class Attachment(Record):
    intervention = models.ForeignKey(Intervention, on_delete=models.PROTECT)
    storage_key = models.CharField(max_length=512, unique=True)
    uploaded_by = models.ForeignKey(USER, on_delete=models.PROTECT)
    content_type = models.CharField(max_length=120)
    size = models.PositiveBigIntegerField()


class CompanySettings(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    timezone = models.CharField(max_length=64, default='Europe/Rome')
    default_vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    location_sharing_enabled = models.BooleanField(default=False)

    class Meta:
        constraints = [models.CheckConstraint(condition=Q(id=1, default_vat_rate__gte=0, default_vat_rate__lte=100), name='company_singleton_valid_vat')]


class AuditLog(Record):
    actor = models.ForeignKey(USER, on_delete=models.PROTECT)
    action = models.CharField(max_length=64)
    entity_id = models.CharField(max_length=64)
    metadata = models.JSONField(default=dict)


class SyncOperation(Record):
    user = models.ForeignKey(USER, on_delete=models.CASCADE)
    operation_id = models.UUIDField()
    request_hash = models.CharField(max_length=64)
    response = models.JSONField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'operation_id'], name='sync_operation_unique')]
