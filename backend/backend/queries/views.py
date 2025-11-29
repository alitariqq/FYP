from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status as drf_status

from .gemini import get_gemini_reply
from .models import ParsedRequest
from .serializers import ParsedRequestSerializer


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def chat_with_gemini(request):
    """
    Accepts a list of chat messages and returns Gemini's reply.
    """
    messages = request.data.get("messages")

    if not messages or not isinstance(messages, list):
        return Response({"error": "messages[] is required"}, status=400)

    reply = get_gemini_reply(messages)
    return Response({"reply": reply})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_parsed_request(request):
    """
    Creates a ParsedRequest entry from frontend JSON.
    Accepts either:
      - latitude & longitude directly, OR
      - location = [lat, lng]
    """

    data = request.data.copy()

    # 1. Prefer explicit lat/lng
    lat = data.get("latitude")
    lng = data.get("longitude")

    # 2. If missing, fallback to `location`
    if lat is None or lng is None:
        location = data.get("location")
        if isinstance(location, list) and len(location) == 2:
            lat, lng = location[0], location[1]
        else:
            return Response(
                {"error": "latitude/longitude missing and invalid fallback 'location' format."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

    # Standardize
    data["latitude"] = lat
    data["longitude"] = lng
    data.pop("location", None)  # remove if exists

    # 3. Attach user
    data["user"] = int(request.user.id)


    serializer = ParsedRequestSerializer(data=data)
    if serializer.is_valid():
        serializer.save()
        return Response(
            {"status": "success", "data": serializer.data},
            status=drf_status.HTTP_201_CREATED
        )

    return Response(serializer.errors, status=drf_status.HTTP_400_BAD_REQUEST)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_user_requests(request):
    """
    Returns all ParsedRequest objects for the logged-in user.
    """
    user = request.user

    requests_qs = ParsedRequest.objects.filter(user=user).order_by("-submitted_at")

    serializer = ParsedRequestSerializer(requests_qs, many=True)

    return Response(serializer.data, status=drf_status.HTTP_200_OK)
