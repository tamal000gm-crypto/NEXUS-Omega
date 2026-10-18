
from datetime import datetime, timezone
from uuid import uuid4

from app.database import get_connection


SCENARIOS = {
    "traffic_spike": {
        "label": "Traffic Spike",
        "cpu_usage": 82.0,
        "memory_usage": 76.0,
        "network_traffic": 1400.0,
        "response_latency": 180.0,
        "error_rate": 2.0,
    },
    "cpu_overload": {
        "label": "CPU Overload",
        "cpu_usage": 100.0,
        "memory_usage": 78.0,
        "network_traffic": 700.0,
        "response_latency": 420.0,
        "error_rate": 4.0,
    },
    "service_latency": {
        "label": "Service Latency",
        "cpu_usage": 72.0,
        "memory_usage": 74.0,
        "network_traffic": 650.0,
        "response_latency": 650.0,
        "error_rate": 8.0,
    },
    "memory_shortage": {
        "label": "Memory Shortage",
        "cpu_usage": 85.0,
        "memory_usage": 100.0,
        "network_traffic": 500.0,
        "response_latency": 350.0,
        "error_rate": 5.0,
    },
}


def initialize_simulations():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS simulations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                simulation_id TEXT UNIQUE NOT NULL,
                scenario TEXT NOT NULL,
                scenario_label TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                metrics TEXT NOT NULL,
                is_anomaly INTEGER NOT NULL,
                severity TEXT NOT NULL,
                anomaly_score INTEGER NOT NULL,
                reasons TEXT NOT NULL,
                recommended_actions TEXT NOT NULL
            )
        """)


def analyze_scenario(scenario_key):
    import json

    if scenario_key not in SCENARIOS:
        raise ValueError("Unknown scenario. Choose a valid scenario key.")

    scenario = SCENARIOS[scenario_key]
    metrics = {
        key: value
        for key, value in scenario.items()
        if key != "label"
    }

    reasons = []

    if metrics["cpu_usage"] >= 90:
        reasons.append("Critical CPU utilization")
    if metrics["memory_usage"] >= 90:
        reasons.append("Critical memory utilization")
    if metrics["network_traffic"] >= 1200:
        reasons.append("Unusually high network traffic")
    if metrics["response_latency"] >= 300:
        reasons.append("High response latency")
    if metrics["error_rate"] >= 5:
        reasons.append("Elevated error rate")

    score = min(100, len(reasons) * 25)

    severity = (
        "critical" if score >= 75
        else "high" if score >= 50
        else "medium" if score >= 25
        else "low"
    )

    actions = []
    if metrics["cpu_usage"] >= 90:
        actions.append("Inspect CPU-intensive processes and capacity.")
    if metrics["memory_usage"] >= 90:
        actions.append("Inspect memory consumption and possible leaks.")
    if metrics["network_traffic"] >= 1200:
        actions.append("Review traffic patterns and rate limits.")
    if metrics["response_latency"] >= 300:
        actions.append("Inspect service latency and downstream dependencies.")
    if metrics["error_rate"] >= 5:
        actions.append("Review application errors and service logs.")
    if not actions:
        actions.append("Continue monitoring system metrics.")

    result = {
        "simulation_id": str(uuid4()),
        "scenario": scenario_key,
        "scenario_label": scenario["label"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metrics": metrics,
        "analysis": {
            "is_anomaly": bool(reasons),
            "status": "anomaly_detected" if reasons else "normal",
            "severity": severity,
            "anomaly_score": score,
            "reasons": reasons,
            "recommended_actions": actions,
        },
    }

    with get_connection() as connection:
        connection.execute("""
            INSERT INTO simulations (
                simulation_id, scenario, scenario_label, timestamp,
                metrics, is_anomaly, severity, anomaly_score,
                reasons, recommended_actions
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            result["simulation_id"],
            result["scenario"],
            result["scenario_label"],
            result["timestamp"],
            json.dumps(metrics),
            int(bool(reasons)),
            severity,
            score,
            json.dumps(reasons),
            json.dumps(actions),
        ))

    return result


def get_simulation_history(limit=20):
    import json

    limit = max(1, min(int(limit), 200))

    with get_connection() as connection:
        rows = connection.execute("""
            SELECT *
            FROM simulations
            ORDER BY id DESC
            LIMIT ?
        """, (limit,)).fetchall()

    results = []
    for row in rows:
        item = dict(row)
        item["metrics"] = json.loads(item["metrics"])
        item["reasons"] = json.loads(item["reasons"])
        item["recommended_actions"] = json.loads(
            item["recommended_actions"]
        )
        item["is_anomaly"] = bool(item["is_anomaly"])
        results.append(item)

    return results


def get_simulation_summary():
    with get_connection() as connection:
        total = connection.execute(
            "SELECT COUNT(*) FROM simulations"
        ).fetchone()[0]

        detected = connection.execute(
            "SELECT COUNT(*) FROM simulations WHERE is_anomaly = 1"
        ).fetchone()[0]

    return {
        "total_runs": total,
        "detected": detected,
        "not_detected": total - detected,
        "detection_rate": round(detected / total * 100, 1) if total else 0.0,
    }


initialize_simulations()
