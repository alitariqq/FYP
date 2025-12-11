from django.urls import path
from .views import DeforestationRunDetailView, ParsedRequestDeforestationView

urlpatterns = [
    path('run/<uuid:id>/', DeforestationRunDetailView.as_view(), name='deforestation-run-detail'),
    path('request/<int:request_id>/', ParsedRequestDeforestationView.as_view(), name='parsed-request-deforestation'),
]
