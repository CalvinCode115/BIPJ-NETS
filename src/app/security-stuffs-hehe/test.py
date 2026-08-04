import requests

print("Testing REST Countries API directly from YOUR machine...")
print()

# Test 1: No fields parameter
url1 = "https://restcountries.com/v3.1/all"
print(f"Test 1: {url1}")
try:
    r = requests.get(url1, timeout=60)
    print(f"  Status: {r.status_code}")
    data = r.json()
    print(f"  Type: {type(data).__name__}")
    if isinstance(data, list):
        print(f"  ✓ SUCCESS: Got {len(data)} countries (list)")
    elif isinstance(data, dict):
        print(f"  Keys: {list(data.keys())}")
        if "data" in data:
            print(f"  data type: {type(data['data']).__name__}")
            if data["data"] is None:
                print(f"  ✗ FAIL: data is null")
            elif isinstance(data["data"], list):
                print(f"  ✓ SUCCESS: Got {len(data['data'])} countries (wrapper)")
        if "errors" in data and data["errors"]:
            print(f"  Errors: {data['errors']}")
    else:
        print(f"  ✗ FAIL: Unexpected type")
except Exception as e:
    print(f"  ✗ ERROR: {e}")

print()

# Test 2: With fields parameter (to confirm it's broken)
url2 = "https://restcountries.com/v3.1/all?fields=name,cca2"
print(f"Test 2: {url2}")
try:
    r = requests.get(url2, timeout=30)
    print(f"  Status: {r.status_code}")
    data = r.json()
    print(f"  Type: {type(data).__name__}")
    if isinstance(data, dict):
        print(f"  Keys: {list(data.keys())}")
        if "data" in data:
            print(f"  data is None: {data['data'] is None}")
        if "errors" in data and data["errors"]:
            print(f"  Errors: {data['errors'][:3]}")  # First 3 errors
except Exception as e:
    print(f"  ✗ ERROR: {e}")

print()
print("If Test 1 shows 0 or null, the REST Countries API is down from your location.")
print("If Test 1 shows 250 but your FastAPI still returns [], the bug is in your main.py")