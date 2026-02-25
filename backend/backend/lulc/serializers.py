from rest_framework import serializers
from .models import LULCStudy, LULCYearResult, LULCConclusion
from queries.models import ParsedRequest

#Nested Serializer for ParsedRequest
class ParsedRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParsedRequest
        fields = '__all__'


class LULCYearResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = LULCYearResult
        fields = '__all__'


class LULCConclusionSerializer(serializers.ModelSerializer):
    class Meta:
        model = LULCConclusion
        fields = '__all__'


class LULCStudySerializer(serializers.ModelSerializer):
    year_results = LULCYearResultSerializer(many=True, read_only=True)
    conclusion = LULCConclusionSerializer(read_only=True)
    parsed_request = ParsedRequestSerializer(read_only=True)

    class Meta:
        model = LULCStudy
        fields = ['id', 'parsed_request', 'status', 'created_at', 'year_results', 'conclusion']
