from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import LULCStudy, LULCYearResult, LULCConclusion
from .serializers import LULCStudySerializer, LULCYearResultSerializer, LULCConclusionSerializer

class LULCStudyViewSet(viewsets.ModelViewSet):
    queryset = LULCStudy.objects.all()
    serializer_class = LULCStudySerializer

    @action(detail=False, methods=['get'], url_path='by-parsed-request/(?P<request_id>[^/.]+)')
    def by_parsed_request(self, request, request_id=None):
        studies = LULCStudy.objects.filter(parsed_request_id=request_id)
        serializer = self.get_serializer(studies, many=True)
        return Response(serializer.data)


class LULCYearResultViewSet(viewsets.ModelViewSet):
    queryset = LULCYearResult.objects.all()
    serializer_class = LULCYearResultSerializer


class LULCConclusionViewSet(viewsets.ModelViewSet):
    queryset = LULCConclusion.objects.all()
    serializer_class = LULCConclusionSerializer
