# backend/queries/gemini.py
from decouple import config
from google.genai import Client
from google.genai.types import GenerateContentConfig, GoogleSearch, Tool

GEMINI_API_KEY = config("GEMINI_API_KEY")

# Use Gemini 2.5 Flash with online/web search
MODEL_NAME = "gemini-2.5-flash"

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
   - distance_to_edge (in metres)
   - is_timeseries (boolean)
   - time_range
   - date_range_start (Date should be format: YYYY-MM-DD, if user specifies only year or month, assume earliest date)
   - date_range_end (Date should be format: YYYY-MM-DD, if user specifies only year or month, assume earliest date)

3. Do NOT output the final JSON until everything is clear.
4. When ready, output:
YOUR RESPONSE MUST START WITH, it should have no other text before or after:

PARSED
{ ...json... }

5. PARSED must be the FIRST LINE.
"""

# Create the client
client = Client(api_key=GEMINI_API_KEY)

def get_gemini_reply(history_messages):
    """
    history_messages = [
        { "role": "user", "content": "..."},
        { "role": "assistant", "content": "..."},
        ...
    ]
    """
    # Start with SYSTEM_PROMPT as first message
    contents = [{
        "role": "user",  # system role works sometimes, but user is safest
        "parts": [{"text": SYSTEM_PROMPT}]
    }]

    # Map DRF roles to Gemini roles
    role_map = {"user": "user", "assistant": "model"}
    for msg in history_messages:
        contents.append({
            "role": role_map.get(msg["role"], "user"),
            "parts": [{"text": msg["content"]}]
        })

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=contents,
        config=GenerateContentConfig(
            tools=[
                Tool(
                    google_search=GoogleSearch()
                )
            ]
        )
    )

    # Return the first generated text
    return response.candidates[0].content.parts[0].text
