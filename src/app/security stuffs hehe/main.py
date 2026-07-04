import os
import requests
from fastapi import Body, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from dotenv import load_dotenv
from fastapi.responses import StreamingResponse

# Load .env file
load_dotenv()

# 1. Configure Gemini SDK
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in environment variables")

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-2.0-flash")

# 2. Google Places API key
GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY")
if not GOOGLE_PLACES_API_KEY:
    raise ValueError("GOOGLE_PLACES_API_KEY not found in environment variables")

app = FastAPI(title="Travel Planner API")

# 3. CORS
# 3. CORS
app.add_middleware(
    CORSMiddleware,
    # Add both ports to the list
    allow_origins=["http://localhost:4200", "http://localhost:8100","http://localhost:8000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. Request/Response models
class TravelRequest(BaseModel):
    destination: str
    days: int = 3
    interests: str = ""

class TravelResponse(BaseModel):
    itinerary: str
    status: str

class PlacesNearbyRequest(BaseModel):
    includedTypes: list[str]
    maxResultCount: int = 5
    lat: float
    lng: float
    radius: float

class PlacesTextRequest(BaseModel):
    textQuery: str
    maxResultCount: int = 5
    lat: float
    lng: float
    radius: float

# 5. Gemini endpoints
@app.post("/api/travel-plan", response_model=TravelResponse)
def generate_travel_plan(request: TravelRequest):
    prompt = (
        f"Generate a {request.days}-day travel itinerary for {request.destination}. "
        f"Interests: {request.interests}."
    )
    response = model.generate_content(prompt)
    return TravelResponse(itinerary=response.text, status="Success")

@app.post("/api/gemini")
def call_gemini(request: dict = Body(...)):
    prompt = request.get("prompt", "")
    if not prompt:
        return {"text": "{}"}
    
    try:
        # Use the model to generate content
        response = model.generate_content(prompt)
        return {"text": response.text}
    except Exception as e:
        # This will print the actual error in your terminal
        print(f"CRITICAL ERROR: {str(e)}") 
        # This returns the error to Angular so you can debug it in the browser
        return {"text": "{}", "error": str(e)}

# 6. Places API proxy endpoints
@app.post("/api/places/nearby")
def places_nearby(request: PlacesNearbyRequest):
    url = "https://places.googleapis.com/v1/places:searchNearby"
    body = {
        "includedTypes": request.includedTypes,
        "maxResultCount": request.maxResultCount,
        "locationRestriction": {
            "circle": {
                "center": {"latitude": request.lat, "longitude": request.lng},
                "radius": request.radius
            }
        }
    }
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.photos,places.location,places.types"
    }
    r = requests.post(url, json=body, headers=headers)
    return r.json()

@app.post("/api/places/text")
def places_text(request: PlacesTextRequest):
    url = "https://places.googleapis.com/v1/places:searchText"
    body = {
        "textQuery": request.textQuery,
        "maxResultCount": request.maxResultCount,
        "locationBias": {
            "circle": {
                "center": {"latitude": request.lat, "longitude": request.lng},
                "radius": request.radius
            }
        }
    }
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.photos,places.location,places.types"
    }
    r = requests.post(url, json=body, headers=headers)
    return r.json()

# 7. Photo proxy
@app.get("/api/photo")
def get_photo(photo_name: str = Query(...)):
    google_url = f"https://places.googleapis.com/v1/{photo_name}/media?maxWidthPx=400&key={GOOGLE_PLACES_API_KEY}"
    r = requests.get(google_url, stream=True)
    return StreamingResponse(
        r.iter_content(chunk_size=1024),
        media_type=r.headers.get('content-type', 'image/jpeg')
    )

# 8. Health check
@app.get("/health")
def health():
    return {"status": "ok"}