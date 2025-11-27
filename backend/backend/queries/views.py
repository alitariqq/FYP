from rest_framework.decorators import api_view
from rest_framework.response import Response
from .gemini import get_gemini_reply


@api_view(["POST"])
def chat_with_gemini(request):
    messages = request.data.get("messages")

    if not messages or not isinstance(messages, list):
        return Response({"error": "messages[] is required"}, status=400)

    reply = get_gemini_reply(messages)

    return Response({"reply": reply})
