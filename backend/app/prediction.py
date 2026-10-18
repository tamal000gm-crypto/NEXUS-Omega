from statistics import mean

from app.telemetry import generate_telemetry

try:
    from app.telemetry import get_telemetry_history
except ImportError:
    get_telemetry_history = None


METRICS = {
    "cpu_usage": {
        "label": "CPU usage",
        "warning": 80,
        "critical": 90,
        "unit": "%",
    },
    "memory_usage": {
        "label": "Memory usage",
        "warning": 80,
        "critical": 90,
        "unit": "%",
    },
    "response_latency": {
        "label": "Response latency",
        "warning": 180,
        "critical": 250,
        "unit": "ms",
    },
    "error_rate": {
        "label": "Error rate",
        "warning": 3,
        "critical": 4.5,
        "unit": "%",
    },
}


def get_records(limit=60):
    """Read recent history, or generate demo samples if history is unavailable."""
    if get_telemetry_history is not None:
        records = get_telemetry_history(limit=limit)
        if records:
            # History may be newest-first; use chronological order for trends.
            return list(reversed(records))

    # Fallback for older telemetry.py versions without history support.
    return [generate_telemetry() for _ in range(min(limit, 60))]


def build_predictions():
    records = get_records()

    if not records:
        return {
            "status": "insufficient_data",
            "message": "No telemetry data is available yet.",
            "samples": 0,
        }

    latest = records[-1]
    recent = records[-10:]
    previous = records[-20:-10] if len(records) >= 20 else records[:-10]

    trends = {}
    warnings = []
    risk_score = 0

    for metric, config in METRICS.items():
        value = float(latest.get(metric, 0))
        recent_values = [float(r[metric]) for r in recent if metric in r]
        previous_values = [float(r[metric]) for r in previous if metric in r]

        recent_avg = mean(recent_values) if recent_values else value
        previous_avg = mean(previous_values) if previous_values else recent_avg

        if recent_avg > previous_avg * 1.05:
            direction = "increasing"
        elif recent_avg < previous_avg * 0.95:
            direction = "decreasing"
        else:
            direction = "stable"

        if value >= config["critical"]:
            severity = "critical"
            risk_score += 30
            warnings.append(
                f'{config["label"]} is at a critical level: {value}{config["unit"]}.'
            )
        elif value >= config["warning"]:
            severity = "warning"
            risk_score += 20
            warnings.append(
                f'{config["label"]} is elevated: {value}{config["unit"]}.'
            )
        else:
            severity = "normal"
            risk_score += 5

        if direction == "increasing" and severity == "normal":
            warnings.append(
                f'{config["label"]} is trending upward; continue monitoring.'
            )
            risk_score += 5

        trends[metric] = {
            "label": config["label"],
            "latest": round(value, 2),
            "recent_average": round(recent_avg, 2),
            "previous_average": round(previous_avg, 2),
            "direction": direction,
            "severity": severity,
            "unit": config["unit"],
        }

    risk_score = min(100, risk_score)

    if risk_score >= 70:
        risk_level = "high"
    elif risk_score >= 40:
        risk_level = "moderate"
    else:
        risk_level = "low"

    recommendations = []
    if trends["cpu_usage"]["severity"] != "normal":
        recommendations.append(
            "Inspect CPU-heavy processes and consider scaling compute resources."
        )
    if trends["memory_usage"]["severity"] != "normal":
        recommendations.append(
            "Inspect memory usage and check for possible memory leaks."
        )
    if trends["response_latency"]["severity"] != "normal":
        recommendations.append(
            "Inspect slow requests, database queries, and network delays."
        )
    if trends["error_rate"]["severity"] != "normal":
        recommendations.append(
            "Review application logs and investigate recurring errors."
        )
    if not recommendations:
        recommendations.append(
            "No threshold breach detected. Continue monitoring system metrics."
        )

    return {
        "status": "ok",
        "mode": "SYNTHETIC_DEMO",
        "prediction_type": "heuristic_risk_estimate",
        "samples_analyzed": len(records),
        "latest_timestamp": latest.get("timestamp"),
        "risk_score": risk_score,
        "risk_level": risk_level,
        "trends": trends,
        "warnings": warnings,
        "recommendations": recommendations,
        "limitations": (
            "Demo estimate based on synthetic telemetry and simple thresholds; "
            "not a trained forecasting model or a guarantee of future failure."
        ),
    }