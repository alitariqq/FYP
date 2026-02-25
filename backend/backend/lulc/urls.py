from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LULCStudyViewSet, LULCYearResultViewSet, LULCConclusionViewSet

router = DefaultRouter()
router.register(r'studies', LULCStudyViewSet, basename='lulc-study')
router.register(r'year-results', LULCYearResultViewSet, basename='lulc-year-result')
router.register(r'conclusions', LULCConclusionViewSet, basename='lulc-conclusion')

urlpatterns = [
    path('', include(router.urls)),
]
