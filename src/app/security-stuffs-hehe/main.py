import os
import requests
from datetime import datetime, timedelta
from fastapi import Body, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi.responses import StreamingResponse
from typing import List, Optional
import polyline
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
# In production the browser reaches this service through the Vercel rewrite
# (/pyapi/* -> this host), so requests are same-origin and CORS never applies.
# The allowlist below only matters for local dev and for hitting the Render URL
# directly. Add extra origins with ALLOWED_ORIGINS="https://a.com,https://b.com".
DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:4200",
    "http://localhost:8100",
    "http://localhost:8000",
]
_extra_origins = [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=DEFAULT_ALLOWED_ORIGINS + _extra_origins,
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

class DirectionsRequest(BaseModel):
    origin: dict  # {"lat": 1.49, "lng": 103.74}
    destination: dict
    waypoints: List[dict] = []  # [{"lat": 1.50, "lng": 103.75}, ...]
    mode: str = "walking"  # walking, driving, transit
    optimize: bool = True  # Google optimizes waypoint order    

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
    


# ─── MULTI-CURRENCY EXCHANGE API ───
# Add these endpoints to your main.py

from fastapi import HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import datetime
import json

# In-memory storage (replace with your DB in production)
_exchange_wallets: Dict[str, dict] = {}
_exchange_history: Dict[str, list] = {}

class ExchangeRequest(BaseModel):
    cardId: str
    fromCurrency: str
    toCurrency: str
    amount: float

class WalletResponse(BaseModel):
    cardId: str
    balances: Dict[str, float]
    currencies: List[str]

class ExchangeTransaction(BaseModel):
    id: str
    cardId: str
    fromCurrency: str
    toCurrency: str
    amount: float
    rate: float
    fee: float
    received: float
    timestamp: str

@app.get("/api/wallet/{card_id}")
def get_wallet(card_id: str):
    """Get multi-currency wallet for a card"""
    wallet = _exchange_wallets.get(card_id, {
        "cardId": card_id,
        "balances": {"SGD": 500.00},
        "currencies": ["SGD"]
    })
    return wallet

@app.post("/api/exchange")
def exchange_currency(req: ExchangeRequest):
    """Exchange currency: deduct fromCurrency, add toCurrency"""
    card_id = req.cardId

    # Get or create wallet
    wallet = _exchange_wallets.get(card_id, {
        "cardId": card_id,
        "balances": {"SGD": 500.00},
        "currencies": ["SGD"]
    })

    # Validate balance
    from_balance = wallet["balances"].get(req.fromCurrency, 0)
    if from_balance < req.amount:
        raise HTTPException(status_code=400, detail=f"Insufficient {req.fromCurrency} balance. Available: {from_balance:.2f}")

    # Get exchange rate (use Frankfurter or fallback)
    rate = _get_exchange_rate(req.fromCurrency, req.toCurrency)
    if rate == 0:
        raise HTTPException(status_code=400, detail=f"Exchange rate not available for {req.fromCurrency} → {req.toCurrency}")

    # Calculate
    fee = req.amount * 0.005  # 0.5% fee
    amount_after_fee = req.amount - fee
    received = amount_after_fee * rate

    # Update balances
    wallet["balances"][req.fromCurrency] = from_balance - req.amount
    wallet["balances"][req.toCurrency] = wallet["balances"].get(req.toCurrency, 0) + received

    # Track currencies
    if req.toCurrency not in wallet["currencies"]:
        wallet["currencies"].append(req.toCurrency)

    # Save wallet
    _exchange_wallets[card_id] = wallet

    # Record transaction
    tx = {
        "id": f"ex_{datetime.now().strftime('%Y%m%d%H%M%S')}_{card_id}",
        "cardId": card_id,
        "fromCurrency": req.fromCurrency,
        "toCurrency": req.toCurrency,
        "amount": req.amount,
        "rate": rate,
        "fee": fee,
        "received": received,
        "timestamp": datetime.now().isoformat()
    }

    if card_id not in _exchange_history:
        _exchange_history[card_id] = []
    _exchange_history[card_id].insert(0, tx)

    return {
        "success": True,
        "message": f"Successfully exchanged {req.amount:.2f} {req.fromCurrency} → {received:.2f} {req.toCurrency}",
        "newBalances": wallet["balances"],
        "transaction": tx
    }

@app.get("/api/exchange/history/{card_id}")
def get_exchange_history(card_id: str, limit: int = 10):
    """Get recent exchange transactions"""
    history = _exchange_history.get(card_id, [])
    return history[:limit]

def _get_exchange_rate(from_curr: str, to_curr: str) -> float:
    """Get exchange rate from Frankfurter or use fallback"""
    try:
        url = f"https://api.frankfurter.app/latest?from={from_curr}&to={to_curr}"
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            data = r.json()
            return data.get("rates", {}).get(to_curr, 0)
    except Exception:
        pass

    # Fallback rates (approximate)
    fallback = {
        ("SGD", "MYR"): 3.45,
        ("SGD", "THB"): 26.2,
        ("SGD", "JPY"): 112.5,
        ("SGD", "KRW"): 985.0,
        ("SGD", "USD"): 0.74,
        ("SGD", "EUR"): 0.68,
        ("SGD", "GBP"): 0.58,
        ("SGD", "AUD"): 1.12,
        ("SGD", "CAD"): 1.01,
        ("SGD", "CHF"): 0.66,
        ("SGD", "CNY"): 5.35,
        ("SGD", "HKD"): 5.78,
        ("SGD", "INR"): 61.5,
        ("SGD", "IDR"): 11500,
        ("SGD", "PHP"): 42.5,
        ("SGD", "VND"): 18500,
        ("SGD", "NZD"): 1.22,
        ("USD", "SGD"): 1.35,
        ("EUR", "SGD"): 1.47,
        ("GBP", "SGD"): 1.72,
    }
    return fallback.get((from_curr, to_curr), 1.0)    

@app.post("/api/directions")
def get_directions(request: DirectionsRequest):
    """
    Get optimized route with Google Directions API.
    """
    base_url = "https://maps.googleapis.com/maps/api/directions/json"
    
    # Build waypoints string
    waypoints_str = ""
    if request.waypoints and len(request.waypoints) > 0:
        waypoint_coords = [f"{w['lat']},{w['lng']}" for w in request.waypoints]
        optimize_flag = "optimize:true|" if request.optimize else ""
        waypoints_str = f"&waypoints={optimize_flag}{'|'.join(waypoint_coords)}"
    
    params = {
        "origin": f"{request.origin['lat']},{request.origin['lng']}",
        "destination": f"{request.destination['lat']},{request.destination['lng']}",
        "mode": request.mode,
        "key": GOOGLE_PLACES_API_KEY,
    }
    
    url = f"{base_url}?{requests.compat.urlencode(params)}{waypoints_str}"
    
    # DEBUG
    print(f"[directions] origin={params['origin']}, dest={params['destination']}, waypoints={len(request.waypoints or [])}, mode={request.mode}")
    
    try:
        r = requests.get(url, timeout=15)
        r.raise_for_status()
        data = r.json()
        
        status = data.get("status", "UNKNOWN_ERROR")
        print(f"[directions] Google status: {status}")
        
        if status == "ZERO_RESULTS":
            return {
                "status": "ZERO_RESULTS",
                "error": "No route found between these points",
                "message": "The origin and destination may be too close or unreachable by this travel mode",
                "optimizedOrder": [],
                "totalDistance": 0,
                "totalDuration": 0,
                "polyline": "",
                "decodedPath": [],
                "legs": [],
                "bounds": {"northeast": {"lat": 0, "lng": 0}, "southwest": {"lat": 0, "lng": 0}}
            }
        
        if status != "OK":
            return {
                "status": status,
                "error": status,
                "message": data.get("error_message", "Directions request failed")
            }
        
        route = data["routes"][0]
        
        # Handle multiple legs properly
        legs = route.get("legs", [])
        
        # Decode polyline
        encoded_polyline = route["overview_polyline"]["points"]
        decoded_path = polyline.decode(encoded_polyline)
        
        return {
            "status": "OK",
            "optimizedOrder": route.get("waypoint_order", []),
            "totalDistance": sum(l["distance"]["value"] for l in legs),
            "totalDuration": sum(l["duration"]["value"] for l in legs),
            "polyline": encoded_polyline,
            "decodedPath": [{"lat": lat, "lng": lng} for lat, lng in decoded_path],
            "legs": [
                {
                    "start": {"lat": l["start_location"]["lat"], "lng": l["start_location"]["lng"]},
                    "end": {"lat": l["end_location"]["lat"], "lng": l["end_location"]["lng"]},
                    "distance": l["distance"]["text"],
                    "duration": l["duration"]["text"],
                    "steps": [
                        {
                            "instruction": s["html_instructions"],
                            "distance": s["distance"]["text"],
                            "duration": s["duration"]["text"],
                        }
                        for s in l["steps"]
                    ]
                }
                for l in legs
            ],
            "bounds": route["bounds"],
        }
        
    except requests.RequestException as e:
        print(f"[directions] Request error: {str(e)}")
        return {"status": "ERROR", "error": str(e), "message": str(e)}
    
@app.get("/api/map/static")
def get_static_map(
    center_lat: float = Query(...),
    center_lng: float = Query(...),
    zoom: int = Query(14),
    width: int = Query(600),
    height: int = Query(300),
    markers: str = Query(""),
    path: str = Query(""),
    polyline: str = Query("")  # Encoded polyline from Google Directions
):
    base_url = "https://maps.googleapis.com/maps/api/staticmap"
    
    url_parts = [
        f"center={center_lat},{center_lng}",
        f"zoom={zoom}",
        f"size={width}x{height}",
        "maptype=roadmap",
        f"key={GOOGLE_PLACES_API_KEY}",
    ]
    
    # Add numbered markers
    if markers:
        marker_list = markers.split("|")
        for i, marker in enumerate(marker_list):
            label = str(i + 1)
            color = "red" if i == 0 else "green" if i == len(marker_list) - 1 else "blue"
            url_parts.append(f"markers=color:{color}|label:{label}|{marker}")
    
    # Add route path - prefer encoded polyline if available
    if polyline:
        url_parts.append(f"path=color:0x34c759|weight:4|enc:{polyline}")
    elif path:
        url_parts.append(f"path=color:0x34c759|weight:4|{path}")
    
    url = base_url + "?" + "&".join(url_parts)
    
    try:
        r = requests.get(url, timeout=15, stream=True)
        r.raise_for_status()
        return StreamingResponse(
            r.iter_content(chunk_size=1024),
            media_type="image/png"
        )
    except requests.RequestException as e:
        return {"error": str(e)}
    
@app.get("/api/map/directions-url")
def get_directions_url(
    origin_lat: float = Query(...),
    origin_lng: float = Query(...),
    dest_lat: float = Query(...),
    dest_lng: float = Query(...),
    waypoints: str = Query("")  # "lat1,lng1|lat2,lng2"
):
    """
    Generate a Google Maps directions URL for opening in native app.
    """
    base = "https://www.google.com/maps/dir/"
    
    origin = f"{origin_lat},{origin_lng}"
    destination = f"{dest_lat},{dest_lng}"
    
    url = f"{base}{origin}/{destination}"
    
    if waypoints:
        url += f"/{waypoints.replace('|', '/')}"
    
    return {"url": url}

# main.py
@app.get("/api/config/google-maps-key")
def get_google_maps_key():
    return {
        "apiKey": GOOGLE_PLACES_API_KEY,
        "mapId": "f93caa09259664b67c1df146",  
        "libraries": "places,marker"
    }

@app.get("/api/places/nearby-point")
def get_places_nearby_point(
    lat: float = Query(..., description="Center latitude"),
    lng: float = Query(..., description="Center longitude"),
    keyword: str = Query(..., description="Search keyword"),
    radius: int = Query(2000, description="Search radius in meters"),
    max_results: int = Query(5, description="Max results to return")
):
    """
    Search for places near a specific point using Google Places API (New).
    """
    url = "https://places.googleapis.com/v1/places:searchNearby"
    
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,  # ← FIXED: actual key from .env
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.photos,places.types,places.regularOpeningHours"
    }
    
    # Valid Google Places API (New) types only
    # Reference: https://developers.google.com/maps/documentation/places/web-service/place-types
    type_mapping = {
        'cafe': ['cafe'],
        'restaurant': ['restaurant'],
        'attraction': ['tourist_attraction'],
        'shopping': ['shopping_mall'],
        'nightlife': ['night_club', 'bar'],
        'activity': ['amusement_park', 'park'],
        'coffee_shop': ['coffee_shop'],
        'bakery': ['bakery'],
        'food': ['food'],
        'bar': ['bar'],
    }
    
    included_types = type_mapping.get(keyword.lower(), [keyword.lower()])
    
    body = {
        "locationRestriction": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": radius
            }
        },
        "includedTypes": included_types,
        "maxResultCount": min(max_results, 20),  # API limit is 20
        "rankPreference": "DISTANCE"
    }
    
    try:
        r = requests.post(url, headers=headers, json=body, timeout=10)
        r.raise_for_status()
        data = r.json()
        
        # Debug: log what Google returned
        print(f"[nearby-point] keyword={keyword}, lat={lat}, lng={lng}, status={r.status_code}, places_found={len(data.get('places', []))}")
        
        places = data.get("places", [])
        
        if not places:
            return {"places": [], "count": 0, "message": f"No {keyword} found within {radius}m"}
        
        formatted = []
        for p in places:
            loc = p.get("location", {})
            formatted.append({
                "id": p.get("id"),
                "displayName": p.get("displayName", {}).get("text", "Unknown"),
                "formattedAddress": p.get("formattedAddress", ""),
                "location": {
                    "latitude": loc.get("latitude", 0),
                    "longitude": loc.get("longitude", 0)
                },
                "rating": p.get("rating", 0),
                "userRatingCount": p.get("userRatingCount", 0),
                "priceLevel": p.get("priceLevel", ""),
                "photos": p.get("photos", []),
                "types": p.get("types", []),
                "regularOpeningHours": p.get("regularOpeningHours", {})
            })
        
        return {"places": formatted, "count": len(formatted)}
        
    except requests.RequestException as e:
        print(f"[nearby-point] ERROR: {str(e)}")
        return {"error": str(e), "places": [], "count": 0}
    
    except Exception as e:
        print(f"[nearby-point] UNEXPECTED ERROR: {str(e)}")
        return {"error": str(e), "places": [], "count": 0}