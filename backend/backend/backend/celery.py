from __future__ import absolute_import, unicode_literals
import os
from celery import Celery

# tell Celery where your Django settings are
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

app = Celery('backend')

# read settings from Django settings.py with CELERY_ prefix
app.config_from_object('django.conf:settings', namespace='CELERY')

# auto-discover tasks in your apps
app.autodiscover_tasks()
