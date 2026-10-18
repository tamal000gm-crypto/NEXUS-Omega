
from app.anomaly import detect_anomaly


def test_normal_telemetry():
    record = {
        "cpu_usage": 45,
        "memory_usage": 60,
        "network_traffic": 450,
        "response_latency": 90,
        "error_rate": 1.0,
    }

    result = detect_anomaly(record)

    assert result["status"] in ["NORMAL", "ANOMALY"]
    assert isinstance(result["is_anomaly"], bool)
    assert result["model"] == "IsolationForest"


def test_extreme_telemetry():
    record = {
        "cpu_usage": 100,
        "memory_usage": 100,
        "network_traffic": 10000,
        "response_latency": 5000,
        "error_rate": 100,
    }

    result = detect_anomaly(record)

    assert result["status"] == "ANOMALY"
    assert result["is_anomaly"] is True


def test_anomaly_score_is_numeric():
    record = {
        "cpu_usage": 50,
        "memory_usage": 55,
        "network_traffic": 400,
        "response_latency": 80,
        "error_rate": 1,
    }

    result = detect_anomaly(record)

    assert isinstance(result["anomaly_score"], float)
