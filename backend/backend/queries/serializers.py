# queries/serializers.py
from rest_framework import serializers
from .models import ParsedRequest

class ParsedRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParsedRequest
        fields = [
            "request_id",
            "user",
            "date_range_start",
            "date_range_end",
            "interval_length",
            "status",
            "submitted_at",
            "completed_at",
            "region_name",
            "latitude",
            "longitude",
            "distance_to_edge",
            "study_type",
            "is_timeseries",
        ]
        read_only_fields = ["request_id", "status", "submitted_at", "completed_at"]
