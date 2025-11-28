from django.urls import path
from .views import chat_with_gemini, create_parsed_request



urlpatterns = [
    path("chat/", chat_with_gemini, name="chat_with_gemini"),
    path('parsed-request/', create_parsed_request, name='create-parsed-request'),
]
