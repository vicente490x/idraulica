from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.permissions import IsAuthenticated
from rest_framework.routers import DefaultRouter
from accounts import views as accounts
from operations.views import CustomerViewSet, InterventionViewSet
from operations.office import OverviewView, AvailabilityViewSet, OfficeConfigView

router = DefaultRouter()
router.register('users', accounts.UserViewSet)
router.register('technicians', accounts.TechnicianViewSet, basename='technician')
router.register('customers', CustomerViewSet, basename='customer')
router.register('interventions', InterventionViewSet, basename='intervention')
router.register('auth/sessions', accounts.SessionViewSet, basename='auth-session')
router.register('availability', AvailabilityViewSet, basename='availability')
urlpatterns = [
    path('api/v1/office/overview/', OverviewView.as_view()),
    path('api/v1/office/config/', OfficeConfigView.as_view()),
    path('api/v1/auth/login/', accounts.LoginView.as_view(), name='login'),
    path('api/v1/auth/refresh/', accounts.RefreshView.as_view(), name='refresh'),
    path('api/v1/auth/logout/', accounts.LogoutView.as_view(), name='logout'),
    path('api/v1/auth/me/', accounts.MeView.as_view()),
    path('api/v1/auth/csrf/', accounts.CSRFView.as_view()),
    path('api/v1/auth/web-login/', accounts.WebLoginView.as_view()),
    path('api/v1/auth/password/change/', accounts.PasswordChangeView.as_view()),
    path('api/v1/auth/password/reset/', accounts.ResetRequestView.as_view()),
    path('api/v1/auth/password/reset/confirm/', accounts.ResetConfirmView.as_view()),
    path('api/v1/schema/', SpectacularAPIView.as_view(permission_classes=[IsAuthenticated]), name='schema'),
    path('api/v1/docs/', SpectacularSwaggerView.as_view(url_name='schema', permission_classes=[IsAuthenticated])),
    path('api/v1/', include(router.urls)),
]
