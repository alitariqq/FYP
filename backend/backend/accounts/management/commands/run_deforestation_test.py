from django.core.management.base import BaseCommand
from accounts.tasks import run_deforestation_job

class Command(BaseCommand):
    help = "Trigger a Celery deforestation job"

    def add_arguments(self, parser):
        parser.add_argument("--lat", type=float, required=True, help="Latitude")
        parser.add_argument("--lon", type=float, required=True, help="Longitude")
        parser.add_argument("--id", type=str, default="test_location", help="Location ID")

    def handle(self, *args, **options):
        lat = options["lat"]
        lon = options["lon"]
        loc_id = options["id"]

        self.stdout.write(self.style.NOTICE(f"Submitting Celery job for {loc_id}..."))

        task = run_deforestation_job.delay(lat, lon, loc_id)

        self.stdout.write(self.style.SUCCESS(f"🎯 Submitted! Celery Task ID = {task.id}"))
        self.stdout.write("Check status using:")
        self.stdout.write(f"  celery -A backend inspect active")
