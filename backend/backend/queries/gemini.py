import google.generativeai as genai
from django.conf import settings
from decouple import config


MODEL_NAME = "gemini-2.5-flash"
GEMINI_API_KEY = config("GEMINI_API_KEY")

SYSTEM_PROMPT = """
You are MANZAR Query Parser.
Your job is to extract structured geospatial analysis requests.

RULES:
1. Ask follow-up questions until all required fields are gathered.
2. Required JSON fields:
   - study_type
   - location
   - time_range
   - resolution_or_dataset
   - extra_parameters

3. Do NOT output the final JSON until everything is clear.
4. When ready, output:

PARSED
{ ...json... }

5. PARSED must be the FIRST LINE.
"""

genai.configure(api_key=GEMINI_API_KEY)

model = genai.GenerativeModel(
    model_name=MODEL_NAME,
    system_instruction=SYSTEM_PROMPT
)

def get_gemini_reply(history_messages):
    """
    history_messages = [
        { "role": "user", "content": "..."},
        { "role": "assistant", "content": "..."},
        ...
    ]
    """

    # Convert to Gemini’s expected format
    converted = []
    for msg in history_messages:
        role = msg["role"]
        if role == "user":
            converted.append({"role": "user", "parts": [msg["content"]]})
        else:
            converted.append({"role": "model", "parts": [msg["content"]]})

    response = model.generate_content(converted)
    return response.text
