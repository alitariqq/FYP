from django.urls import path
from .views import chat_with_gemini, create_parsed_request, list_user_requests



urlpatterns = [
    path("chat/", chat_with_gemini, name="chat_with_gemini"),
    path('parsed-request/', create_parsed_request, name='create-parsed-request'),
    path("my-requests/", list_user_requests, name="list_user_requests"),
]
