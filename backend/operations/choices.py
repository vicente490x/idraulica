def intervention_status_choices():
    from .models import Intervention
    return Intervention.Status.choices
