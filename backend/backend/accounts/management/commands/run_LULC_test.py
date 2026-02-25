from django.core.management.base import BaseCommand
from accounts.tasks import run_LULC_job

class Command(BaseCommand):
    help = "Trigger a Celery LULC job"

    def add_arguments(self, parser):
        parser.add_argument("--lat", type=float, required=True, help="Latitude")
        parser.add_argument("--lon", type=float, required=True, help="Longitude")
        parser.add_argument("--radius", type=float, required=True, help="Radius in kilometers")
        parser.add_argument("--year", type=int, required=True, help="Year of LULC data")
        parser.add_argument("--id", type=str, default="test_location", help="Location ID")

    def handle(self, *args, **options):
        lat = options["lat"]
        lon = options["lon"]
        radius = options["radius"]
        year = options["year"]
        loc_id = options["id"]

        self.stdout.write(self.style.NOTICE(f"Submitting Celery job for {loc_id}..."))

        task = run_LULC_job.delay(lat, lon, radius, year, loc_id)

        self.stdout.write(self.style.SUCCESS(f"Task Submitted! Celery Task ID = {task.id}"))
        self.stdout.write("Check status using:")
        self.stdout.write(f"  celery -A backend inspect active")
