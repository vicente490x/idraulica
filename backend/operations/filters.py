import django_filters
from .models import Intervention


class InterventionFilter(django_filters.FilterSet):
    # Half-open overlap window, includes appointments crossing midnight.
    start = django_filters.IsoDateTimeFilter(field_name='ends_at', lookup_expr='gt')
    end = django_filters.IsoDateTimeFilter(field_name='starts_at', lookup_expr='lt')

    class Meta:
        model = Intervention
        fields = ['technician', 'customer', 'status', 'priority', 'start', 'end']
