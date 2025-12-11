# queries/tasks.py

from celery import shared_task
from processing.imagery_downloader import download_pair
from processing.inference import run_deforestation_detection

@shared_task
def run_deforestation_job(lat, lon, location_id):
    before, after = download_pair(lat, lon, location_id)
    result = run_deforestation_detection(before, after)
    return result.tolist()
