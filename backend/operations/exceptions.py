from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import ProtectedError
from django.db import IntegrityError
import logging
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler


class Conflict(APIException):
    status_code = 409
    default_detail = 'Dati aggiornati da un altro utente. Ricarica prima di riprovare.'
    default_code = 'conflict'


def api_exception_handler(exc, context):
    if isinstance(exc, DjangoValidationError):
        exc = ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages)
    if isinstance(exc, ProtectedError):
        exc = Conflict('Risorsa collegata ad altri dati; eliminazione non consentita.')
    if isinstance(exc, IntegrityError):
        exc = Conflict('Operazione in conflitto con i vincoli dei dati.')
    response = exception_handler(exc, context)
    if response is None:
        logging.getLogger(__name__).error('Errore API non gestito: %s', type(exc).__name__)
        return Response({'error': {'code': 'internal_error', 'details': 'Errore interno del server.'}}, status=500)
    response.data = {'error': {'code': getattr(exc, 'default_code', 'request_error'), 'details': response.data}}
    return response
