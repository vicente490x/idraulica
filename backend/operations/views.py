from django.db import transaction
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from accounts.models import User
from .models import Customer, Intervention, AuditLog
from .permissions import OfficeWrite
from .serializers import CustomerSerializer, InterventionSerializer, StatusHistorySerializer, StatusChangeSerializer
from .services import create_intervention, update_intervention, change_status
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from .filters import InterventionFilter


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.none()
    serializer_class = CustomerSerializer
    permission_classes = [OfficeWrite]
    search_fields = ['first_name', 'last_name_or_company', 'phone', 'email', 'address']
    filterset_fields = ['city']
    ordering_fields = ['last_name_or_company', 'created_at']

    def get_queryset(self):
        query = Customer.objects.all().order_by('last_name_or_company', 'id')
        if self.request.user.role == User.Role.TECHNICIAN:
            query = query.filter(interventions__technician=self.request.user).distinct()
        return query

    def perform_create(self, serializer):
        with transaction.atomic():
            obj = serializer.save()
            AuditLog.objects.create(actor=self.request.user, action='customer.create', entity_id=str(obj.pk))

    def perform_update(self, serializer):
        with transaction.atomic():
            obj = serializer.save()
            AuditLog.objects.create(actor=self.request.user, action='customer.update', entity_id=str(obj.pk))

    def perform_destroy(self, instance):
        with transaction.atomic():
            AuditLog.objects.create(actor=self.request.user, action='customer.delete', entity_id=str(instance.pk))
            instance.delete()


class InterventionViewSet(viewsets.ModelViewSet):
    queryset = Intervention.objects.none()
    serializer_class = InterventionSerializer
    permission_classes = [OfficeWrite]
    http_method_names = ['get', 'post', 'put', 'patch', 'head', 'options']
    filterset_class = InterventionFilter
    search_fields = ['title', 'description', 'address']
    ordering_fields = ['starts_at', 'updated_at', 'priority']

    def get_queryset(self):
        query = Intervention.objects.select_related('customer', 'technician').order_by('starts_at', 'id')
        if self.request.user.role == User.Role.TECHNICIAN:
            query = query.filter(technician=self.request.user)
        return query

    def perform_create(self, serializer):
        serializer.instance = create_intervention(dict(serializer.validated_data), self.request.user)

    def perform_update(self, serializer):
        serializer.instance = update_intervention(serializer.instance, dict(serializer.validated_data), self.request.user)

    @action(detail=True, methods=['get'], serializer_class=StatusHistorySerializer)
    def history(self, request, pk=None):
        history = self.get_object().history.order_by('created_at', 'id')
        page = self.paginate_queryset(history)
        return self.get_paginated_response(StatusHistorySerializer(page, many=True).data)

    @extend_schema(responses=inline_serializer('StatusResult', fields={'id': serializers.UUIDField(), 'status': serializers.ChoiceField(choices=Intervention.Status.choices), 'version': serializers.IntegerField()}))
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated], serializer_class=StatusChangeSerializer, url_path='status')
    def change_status(self, request, pk=None):
        obj = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(change_status(obj, serializer.validated_data, request.user))
