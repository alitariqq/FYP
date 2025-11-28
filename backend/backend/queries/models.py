from django.db import models
from django.contrib.auth.models import User
from django.conf import settings

class ParsedRequest(models.Model):
    STATUS_CHOICES = [
        ('CREATED', 'Created'),
        ('PROCESSING', 'Processing'),
        ('ERROR', 'Error'),
        ('FINISHED', 'Finished'),
    ]

    # Primary key (auto-generated id can serve as request_id, or use UUID)
    request_id = models.AutoField(primary_key=True)

    # Time range / interval
    date_range_start = models.DateField()
    date_range_end = models.DateField()
    interval_length = models.IntegerField(help_text="Length of interval in days, months, or years depending on your logic")

    # Pipeline status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='CREATED')
    submitted_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Location info
    region_name = models.CharField(max_length=255)
    latitude = models.FloatField()
    longitude = models.FloatField()
    distance_to_edge = models.FloatField()

    # Study info
    study_type = models.CharField(max_length=255)
    is_timeseries = models.BooleanField(default=False)

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="parsed_requests")

    def __str__(self):
        return f"{self.region_name} ({self.request_id}) - {self.status}"
