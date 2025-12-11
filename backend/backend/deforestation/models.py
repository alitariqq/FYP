from django.db import models
from django.utils import timezone
from queries.models import ParsedRequest


class DeforestationRun(models.Model):

    id = models.AutoField(primary_key=True)

    parsed_request = models.OneToOneField(
        ParsedRequest,
        on_delete=models.CASCADE,
        related_name="deforestation_result"
    )

    created_at = models.DateTimeField(default=timezone.now)

    # Optional input imagery paths
    before_image_path = models.TextField(null=True, blank=True)
    after_image_path = models.TextField(null=True, blank=True)

    # Mask output
    mask_path = models.TextField(null=True, blank=True)
    mask_colormap_path = models.TextField(null=True, blank=True)

    # Metrics JSON
    metrics_json = models.JSONField(null=True, blank=True)

    # Status
    STATUS_CHOICES = [
        ("processing", "Processing"),
        ("done", "Done"),
        ("error", "Error"),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="processing")
    error_message = models.TextField(null=True, blank=True)

    model_version = models.CharField(max_length=100, null=True, blank=True)

    def __str__(self):
        return f"DeforestationRun for Request {self.parsed_request_id} ({self.status})"
