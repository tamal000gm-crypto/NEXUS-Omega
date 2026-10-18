
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


# Test 1: Home API
def test_home():
    response = client.get("/")

    assert response.status_code == 200

    data = response.json()

    assert data["project"] == "NEXUS Ω"
    assert data["status"] == "running"
    assert data["mode"] == "DEMO"
    assert data["version"] == "0.2.0"


# Test 2: Health Check API
def test_health():
    response = client.get("/api/health")

    assert response.status_code == 200

    data = response.json()

    assert data["status"] == "healthy"
    assert data["service"] == "nexus-backend"
    assert data["demo_mode"] is True


# Test 3: Single Telemetry API
def test_telemetry():
    response = client.get("/api/telemetry")

    assert response.status_code == 200

    data = response.json()

    assert "timestamp" in data
    assert 0 <= data["cpu_usage"] <= 100
    assert 0 <= data["memory_usage"] <= 100
    assert data["network_traffic"] >= 0
    assert data["response_latency"] >= 0
    assert 0 <= data["error_rate"] <= 100
    assert data["mode"] == "SYNTHETIC_DEMO"


# Test 4: Batch Telemetry API
def test_telemetry_batch():
    response = client.get("/api/telemetry/batch?limit=5")

    assert response.status_code == 200

    data = response.json()

    assert data["count"] == 5
    assert data["mode"] == "SYNTHETIC_DEMO"
    assert len(data["records"]) == 5

    for record in data["records"]:
        assert "timestamp" in record
        assert 0 <= record["cpu_usage"] <= 100
        assert 0 <= record["memory_usage"] <= 100
        assert record["network_traffic"] >= 0
        assert record["response_latency"] >= 0
        assert 0 <= record["error_rate"] <= 100
        assert record["mode"] == "SYNTHETIC_DEMO"


# Test 5: Batch API rejects an invalid limit
def test_telemetry_batch_invalid_limit():
    response = client.get("/api/telemetry/batch?limit=101")

    assert response.status_code == 422


# Test 6: AI detects extreme telemetry
def test_analyze_extreme_telemetry():
    response = client.post(
        "/api/analyze",
        json={
            "cpu_usage": 100,
            "memory_usage": 100,
            "network_traffic": 10000,
            "response_latency": 5000,
            "error_rate": 100,
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["project"] == "NEXUS Ω"
    assert data["input"]["cpu_usage"] == 100
    assert data["analysis"]["status"] == "ANOMALY"
    assert data["analysis"]["is_anomaly"] is True
    assert data["analysis"]["model"] == "IsolationForest"


# Test 7: AI API rejects invalid telemetry
def test_analyze_invalid_telemetry():
    response = client.post(
        "/api/analyze",
        json={
            "cpu_usage": 150,
            "memory_usage": 60,
            "network_traffic": 450,
            "response_latency": 90,
            "error_rate": 1,
        },
    )

    assert response.status_code == 422

