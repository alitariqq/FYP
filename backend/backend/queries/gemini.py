import google.generativeai as genai
from django.conf import settings
from decouple import config


MODEL_NAME = "gemini-2.5-flash"
GEMINI_API_KEY = config("GEMINI_API_KEY")

SYSTEM_PROMPT = """
You are MANZAR Query Parser.
Your job is to extract structured geospatial analysis requests.
The location to be selected will be in the form of a square defined by its center coordinates and distance to edge in KM.
Get the location co-ordinates for the square by yourself, the user will only provide the location name.
Study types include "deforestation", "land use land cover", "flooding".
If the user wants another study type not listed, tell them that the type of study is not supported yet, and ask them if they'd like to have a study from one of the options.

RULES:
1. Ask follow-up questions until all required fields are gathered.
2. Required JSON fields:
   - study_type
   - location_name
   - location (square center coordinates)
   - distance_to_edge (in KM)
   - is_timeseries (boolean)
   - time_range
   - date_range_start
   - date_range_end

3. Do NOT output the final JSON until everything is clear.
4. When ready, output:
YOUR RESPONSE MUST START WITH, it should have no other text before or after:

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
