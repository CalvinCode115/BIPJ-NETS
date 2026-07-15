import os
import requests
from datetime import datetime, timedelta
from fastapi import Body, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi.responses import StreamingResponse

# Load .env file
load_dotenv()

# 1. API Keys
GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY")
if not GOOGLE_PLACES_API_KEY:
    raise ValueError("GOOGLE_PLACES_API_KEY not found in environment variables")

WORLDNEWS_API_KEY = os.getenv("WORLDNEWS_API_KEY")
if not WORLDNEWS_API_KEY:
    raise ValueError("WORLDNEWS_API_KEY not found in environment variables")

WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")
if not WEATHER_API_KEY:
    raise ValueError("WEATHER_API_KEY not found in environment variables")

app = FastAPI(title="Travel Planner API")

# 2. CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://localhost:8100", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ═════════════════════════════════════════════════════════════════
# REQUEST/RESPONSE MODELS
# ═════════════════════════════════════════════════════════════════

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

class FxHistoryRequest(BaseModel):
    base: str = "SGD"
    target: str = "MYR"
    days: int = 30

class FxNewsRequest(BaseModel):
    base: str = "SGD"
    target: str = "MYR"

# ═════════════════════════════════════════════════════════════════
# PLACES API PROXY ENDPOINTS (unchanged)
# ═════════════════════════════════════════════════════════════════

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

@app.get("/api/photo")
def get_photo(photo_name: str = Query(...)):
    google_url = f"https://places.googleapis.com/v1/{photo_name}/media?maxWidthPx=400&key={GOOGLE_PLACES_API_KEY}"
    r = requests.get(google_url, stream=True)
    return StreamingResponse(
        r.iter_content(chunk_size=1024),
        media_type=r.headers.get('content-type', 'image/jpeg')
    )

# ═════════════════════════════════════════════════════════════════
# FX RATE PROXY ENDPOINTS (NEW)
# ═════════════════════════════════════════════════════════════════

@app.post("/api/fx/history")
def fx_history(request: FxHistoryRequest):
    """
    Proxy to Frankfurter API for historical FX rates.
    Angular calls this instead of hitting Frankfurter directly.
    """
    end = datetime.now()
    start = end - timedelta(days=request.days)
    
    from_date = start.strftime("%Y-%m-%d")
    to_date = end.strftime("%Y-%m-%d")
    
    frankfurter_url = (
        f"https://api.frankfurter.dev/v1/"
        f"{from_date}..{to_date}"
        f"?base={request.base}&symbols={request.target}"
    )
    
    try:
        r = requests.get(frankfurter_url, timeout=10)
        r.raise_for_status()
        return r.json()
    except requests.RequestException as e:
        return {
            "error": str(e),
            "base": request.base,
            "rates": {}
        }

@app.post("/api/fx/news-sentiment")
def fx_news_sentiment(request: FxNewsRequest):
    # Broader queries that actually return results
    broad_queries = {
        'SGD-MYR': 'Malaysia economy business',
        'MYR-SGD': 'Malaysia economy business',
        'SGD-THB': 'Thailand economy business tourism',
        'THB-SGD': 'Thailand economy business tourism',
        'SGD-JPY': 'Japan economy business',
        'JPY-SGD': 'Japan economy business',
        'SGD-KRW': 'South Korea economy business',
        'KRW-SGD': 'South Korea economy business',
        'SGD-AUD': 'Australia economy business',
        'AUD-SGD': 'Australia economy business',
    }
    
    query = broad_queries.get(f"{request.base}-{request.target}", 
                              f"{request.target} economy business")
    
    # Remove categories filter to get more results
    url = (
        f"https://api.worldnewsapi.com/search-news"
        f"?api-key={WORLDNEWS_API_KEY}"
        f"&text={requests.utils.quote(query)}"
        f"&language=en"
        f"&number=10"  # removed categories=business
    )
    
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        data = r.json()
        
        articles = data.get("news", [])
        if not articles:
            # Fallback: try even broader query
            return fallback_news_search(request.target)
        
        total_sentiment = sum(a.get("sentiment", 0) for a in articles)
        avg_score = total_sentiment / len(articles)
        
        return {
            "score": round(avg_score, 2),
            "articleCount": len(articles),
            "headlines": [a.get("title", "") for a in articles[:5]],
        }
        
    except requests.RequestException as e:
        return fallback_news_search(request.target)

def fallback_news_search(country_keyword: str):
    """Ultra-broad fallback that almost always returns something"""
    url = (
        f"https://api.worldnewsapi.com/search-news"
        f"?api-key={WORLDNEWS_API_KEY}"
        f"&text={country_keyword}"
        f"&language=en"
        f"&number=5"
    )
    try:
        r = requests.get(url, timeout=10)
        data = r.json()
        articles = data.get("news", [])
        if articles:
            total = sum(a.get("sentiment", 0) for a in articles)
            return {
                "score": round(total / len(articles), 2),
                "articleCount": len(articles),
                "headlines": [a.get("title", "") for a in articles[:3]],
            }
    except:
        pass
    
    # Ultimate fallback: neutral
    return {"score": 0, "articleCount": 0, "headlines": []}

@app.get("/api/fx/latest")
def fx_latest(base: str = "SGD", target: str = "MYR"):
    """
    Get latest FX rate (single day).
    """
    today = datetime.now().strftime("%Y-%m-%d")
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    
    frankfurter_url = (
        f"https://api.frankfurter.dev/v1/"
        f"{yesterday}..{today}"
        f"?base={base}&symbols={target}"
    )
    
    try:
        r = requests.get(frankfurter_url, timeout=10)
        r.raise_for_status()
        return r.json()
    except requests.RequestException as e:
        return {"error": str(e), "base": base, "rates": {}}

# ═════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ═════════════════════════════════════════════════════════════════

@app.get("/health")
def health():
    return {
        "status": "ok",
        "services": {
            "places": "active",
            "fx_history": "active",
            "fx_news": "active"
        }
    }

@app.get("/api/weather")
def get_weather(
    lat: float = Query(1.4927, description="Latitude"),
    lon: float = Query(103.7414, description="Longitude"),
    units: str = Query("metric", description="Units: metric, imperial, standard")
):
    """
    Proxy to OpenWeatherMap. Keeps API key server-side.
    Defaults to Johor Bahru if no coordinates provided.
    """
    url = (
        f"https://api.openweathermap.org/data/2.5/weather"
        f"?lat={lat}"
        f"&lon={lon}"
        f"&appid={WEATHER_API_KEY}"
        f"&units={units}"
    )
    
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        data = r.json()
        
        # Return a simplified shape matching what Angular expects
        return {
            "temp": round(data["main"]["temp"]),
            "condition": data["weather"][0]["main"],
            "description": data["weather"][0]["description"],
            "icon": data["weather"][0]["icon"],
            "humidity": data["main"]["humidity"],
            "windSpeed": data.get("wind", {}).get("speed", 0),
            "city": data.get("name", "Unknown"),
            "country": data.get("sys", {}).get("country", ""),
            "raw": data  # pass full response if needed
        }
        
    except requests.RequestException as e:
        return {
            "error": str(e),
            "temp": 67,
            "condition": "Clouds",
            "humidity": 80
        }
    
    # Add this endpoint alongside your existing /api/weather

@app.get("/api/weather/forecast")
def get_weather_forecast(
    lat: float = Query(1.4927, description="Latitude"),
    lon: float = Query(103.7414, description="Longitude"),
    units: str = Query("metric", description="Units: metric, imperial, standard")
):
    """
    5-day weather forecast from OpenWeatherMap (free tier).
    Returns daily summaries aggregated from 3-hour intervals.
    """
    url = (
        f"https://api.openweathermap.org/data/2.5/forecast"
        f"?lat={lat}"
        f"&lon={lon}"
        f"&appid={WEATHER_API_KEY}"
        f"&units={units}"
    )
    
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        data = r.json()
        
        # Aggregate 3-hour intervals into daily summaries
        daily = {}
        for item in data.get("list", []):
            date = item["dt_txt"].split(" ")[0]  # "2026-07-06"
            if date not in daily:
                daily[date] = {
                    "temps": [],
                    "conditions": [],
                    "icons": [],
                    "humidity": [],
                    "wind": []
                }
            daily[date]["temps"].append(item["main"]["temp"])
            daily[date]["conditions"].append(item["weather"][0]["main"])
            daily[date]["icons"].append(item["weather"][0]["icon"])
            daily[date]["humidity"].append(item["main"]["humidity"])
            daily[date]["wind"].append(item.get("wind", {}).get("speed", 0))
        
        # Summarize each day
        forecast = []
        for date, values in sorted(daily.items())[:5]:  # max 5 days
            # Most frequent condition
            condition = max(set(values["conditions"]), key=values["conditions"].count)
            # Most frequent icon
            icon = max(set(values["icons"]), key=values["icons"].count)
            
            forecast.append({
                "date": date,
                "dayOfWeek": datetime.strptime(date, "%Y-%m-%d").strftime("%A"),
                "tempMin": round(min(values["temps"])),
                "tempMax": round(max(values["temps"])),
                "tempAvg": round(sum(values["temps"]) / len(values["temps"])),
                "condition": condition,
                "icon": icon,
                "humidity": round(sum(values["humidity"]) / len(values["humidity"])),
                "windSpeed": round(sum(values["wind"]) / len(values["wind"]), 1),
                "isRainy": condition in ["Rain", "Thunderstorm", "Drizzle"],
                "isHot": max(values["temps"]) > 33,
            })
        
        return {"city": data.get("city", {}).get("name", "Johor Bahru"), "forecast": forecast}
        
    except requests.RequestException as e:
        return {"error": str(e), "forecast": []}



# ═════════════════════════════════════════════════════════════════
# REST COUNTRIES API v5 PROXY (for 3D Globe)
# v3.1 is deprecated. v5 requires API key.
# Using demo key "rc_live_demo" — works without signup.
# Sign up at restcountries.com for a production key.
# ═════════════════════════════════════════════════════════════════

RC_API_KEY = "rc_live_demo"  # Demo key — free, no signup required
RC_BASE_URL = "https://api.restcountries.com/countries/v5"

@app.get("/api/countries/all")
def get_all_countries():
    # Fallback: public countries JSON (no API key needed)
    url = "https://raw.githubusercontent.com/mledoze/countries/master/countries.json"
    try:
        r = requests.get(url, timeout=60)
        r.raise_for_status()
        countries = r.json()
        if isinstance(countries, list) and len(countries) > 100:
            print(f"[API] Loaded {len(countries)} countries")
            return countries
    except Exception as e:
        print(f"[API] Error: {e}")
    return []

@app.get("/api/countries/search")
def search_countries(q: str = Query(..., description="Search query")):
    """
    Proxy to REST Countries API v5 — search by name.
    """
    url = f"{RC_BASE_URL}?q={requests.utils.quote(q)}&response_fields=names.common,codes.alpha_2,capitals,currencies,region,flag.emoji&limit=50"
    headers = {"Authorization": f"Bearer {RC_API_KEY}"}

    try:
        r = requests.get(url, headers=headers, timeout=15)
        r.raise_for_status()
        data = r.json()
        return data.get("data", {}).get("objects", [])

    except Exception as e:
        print(f"[API Error] /api/countries/search failed: {e}")
        return []

@app.get("/api/countries/debug")
def debug_countries_api():
    """Diagnostic endpoint"""
    url = f"{RC_BASE_URL}?limit=3"
    headers = {"Authorization": f"Bearer {RC_API_KEY}"}
    try:
        r = requests.get(url, headers=headers, timeout=30)
        data = r.json()
        return {
            "status": r.status_code,
            "has_data_key": "data" in data,
            "has_objects": "objects" in data.get("data", {}),
            "object_count": len(data.get("data", {}).get("objects", [])),
            "first_item": data.get("data", {}).get("objects", [{}])[0] if data.get("data", {}).get("objects") else None,
        }
    except Exception as e:
        return {"error": str(e)}
    

    