from rest_framework import serializers
from .models import DeforestationRun
from queries.models import ParsedRequest

# Serializer for the deforestation run itself
class DeforestationRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeforestationRun
        fields = [
            'id',
            'parsed_request',
            'status',
            'error_message',
            'before_image_path',
            'after_image_path',
            'mask_path',
            'mask_colormap_path',
            'metrics_json',
            'model_version',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


# Nested serializer to fetch a ParsedRequest along with its DeforestationRun
class ParsedRequestWithDeforestationSerializer(serializers.ModelSerializer):
    deforestation_result = DeforestationRunSerializer(read_only=True)

    class Meta:
        model = ParsedRequest
        fields = [
            'request_id',
            'region_name',
            'latitude',
            'longitude',
            'distance_to_edge',
            'status',
            'submitted_at',
            'completed_at',
            'study_type',
            'is_timeseries',
            'deforestation_result',
        ]
