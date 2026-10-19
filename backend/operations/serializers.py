from rest_framework import serializers
from accounts.models import User
from .models import Customer, Intervention, StatusHistory


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ['id', 'first_name', 'last_name_or_company', 'phone', 'email', 'address', 'city', 'postal_code', 'latitude', 'longitude', 'notes', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get('request')
        if request and getattr(request.user, 'role', None) == User.Role.TECHNICIAN:
            fields.pop('notes', None)
        return fields

    def validate(self, attrs):
        lat = attrs.get('latitude', getattr(self.instance, 'latitude', None))
        lon = attrs.get('longitude', getattr(self.instance, 'longitude', None))
        if (lat is None) != (lon is None):
            raise serializers.ValidationError('Inserire entrambe le coordinate.')
        return attrs


class InterventionSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
    customer_phone = serializers.CharField(source='customer.phone', read_only=True)
    technician_name = serializers.SerializerMethodField()
    allowed_transitions = serializers.SerializerMethodField()
    planning_editable = serializers.SerializerMethodField()
    technician = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(role=User.Role.TECHNICIAN, is_active=True), allow_null=True, required=False)
    # This is a concurrency precondition on update, never an arbitrary version assignment.
    version = serializers.IntegerField(min_value=1, required=False)

    class Meta:
        model = Intervention
        fields = ['id', 'customer', 'customer_name', 'customer_phone', 'technician', 'technician_name', 'title', 'description', 'intervention_type', 'priority', 'starts_at', 'ends_at', 'address', 'status', 'office_notes', 'technician_notes', 'version', 'created_at', 'updated_at', 'allowed_transitions', 'planning_editable']
        read_only_fields = ['id', 'status', 'created_at', 'updated_at']

    def get_customer_name(self, obj) -> str:
        return f'{obj.customer.first_name} {obj.customer.last_name_or_company}'.strip()

    def get_technician_name(self, obj) -> str:
        return f'{obj.technician.first_name} {obj.technician.last_name}'.strip() if obj.technician else ''

    def get_allowed_transitions(self, obj) -> list[str]:
        from .services import TRANSITIONS, TECHNICIAN_TARGETS
        targets = TRANSITIONS[obj.status]
        request = self.context.get('request')
        if request and getattr(request.user, 'role', None) == User.Role.TECHNICIAN:
            targets = targets & TECHNICIAN_TARGETS
        return sorted(targets)

    def get_planning_editable(self, obj) -> bool:
        return obj.status in {'scheduled', 'assigned', 'confirmed', 'reschedule'}

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get('request')
        if request and getattr(request.user, 'role', None) == User.Role.TECHNICIAN:
            fields.pop('office_notes', None)
        return fields

    def validate(self, attrs):
        if self.instance and 'version' not in attrs:
            raise serializers.ValidationError({'version': 'Versione attuale obbligatoria.'})
        if not self.instance and 'version' in attrs:
            raise serializers.ValidationError({'version': 'La versione iniziale è assegnata dal server.'})
        if 'status' in self.initial_data:
            raise serializers.ValidationError({'status': 'Usare l’endpoint status.'})
        return attrs


class StatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = StatusHistory
        fields = ['id', 'previous_status', 'new_status', 'actor', 'created_at']
        read_only_fields = fields


class StatusChangeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Intervention.Status.choices)
    version = serializers.IntegerField(min_value=1)
    operation_id = serializers.UUIDField()
    technician_notes = serializers.CharField(required=False, allow_blank=True, max_length=10000)
