from django.db import models
from queries.models import ParsedRequest

class LULCStudy(models.Model):
    parsed_request = models.ForeignKey(
        ParsedRequest,
        on_delete=models.CASCADE,
        related_name="lulc_studies"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, default="pending")  # pending, processing, done

    def __str__(self):
        return f"Study {self.id} - Request {self.parsed_request.id}"


class LULCYearResult(models.Model):
    study = models.ForeignKey(LULCStudy, on_delete=models.CASCADE, related_name="year_results")
    year = models.IntegerField()

    image_path = models.TextField()
    mask_path = models.TextField()
    metrics_json = models.JSONField(null=True, blank=True)  # <- fixed here

    status = models.CharField(max_length=20, default="processing")
    model_version = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('study', 'year')
        ordering = ['year']

    def __str__(self):
        return f"Year {self.year} - Study {self.study.id}"


class LULCConclusion(models.Model):
    study = models.OneToOneField(LULCStudy, on_delete=models.CASCADE, related_name="conclusion")
    metrics_json = models.JSONField(null=True, blank=True)  # <- fixed here
    conclusion_text = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Conclusion for Study {self.study.id}"
