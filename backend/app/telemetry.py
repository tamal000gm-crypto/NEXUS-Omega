
from datetime import datetime, timezone
import random

from app.database import (
    save_telemetry,
    get_telemetry_history as read_telemetry_history,
    get_telemetry_summary as read_telemetry_summary,
)


def generate_telemetry():
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "cpu_usage": round(random.uniform(15, 85), 2),
        "memory_usage": round(random.uniform(30, 90), 2),
        "network_traffic": round(random.uniform(100, 1000), 2),
        "response_latency": round(random.uniform(20, 250), 2),
        "error_rate": round(random.uniform(0, 5), 2),
        "mode": "SYNTHETIC_DEMO",
    }

    # Save telemetry to SQLite before returning it.
    save_telemetry(record)

    return record


def get_telemetry_history(limit=60):
    return read_telemetry_history(limit=limit)


def get_telemetry_summary():
    return read_telemetry_summary()
