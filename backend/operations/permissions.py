from rest_framework.permissions import BasePermission, SAFE_METHODS
from accounts.models import User


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.role == User.Role.ADMIN)


class OfficeWrite(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and (
            request.method in SAFE_METHODS or request.user.role in {User.Role.ADMIN, User.Role.OFFICE}
        ))
