from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .models import DeforestationRun
from .serializers import DeforestationRunSerializer
from queries.models import ParsedRequest
from .serializers import ParsedRequestWithDeforestationSerializer

# Fetch a single deforestation run by its ID
class DeforestationRunDetailView(generics.RetrieveAPIView):
    queryset = DeforestationRun.objects.all()
    serializer_class = DeforestationRunSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'


# Fetch the deforestation result for a specific ParsedRequest
class ParsedRequestDeforestationView(generics.RetrieveAPIView):
    queryset = ParsedRequest.objects.all()
    serializer_class = ParsedRequestWithDeforestationSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'request_id'
