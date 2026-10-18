
from app.database import get_telemetry_history


METRICS = {
    "cpu_usage": {
        "label": "CPU Usage",
        "unit": "%",
        "warning": 70,
        "critical": 85,
        "weight": 20,
    },
    "memory_usage": {
        "label": "Memory Usage",
        "unit": "%",
        "warning": 75,
        "critical": 90,
        "weight": 25,
    },
    "response_latency": {
        "label": "Response Latency",
        "unit": "ms",
        "warning": 150,
        "critical": 220,
        "weight": 25,
    },
    "error_rate": {
        "label": "Error Rate",
        "unit": "%",
        "warning": 2,
        "critical": 4,
        "weight": 30,
    },
    "network_traffic": {
        "label": "Network Traffic",
        "unit": "units",
        "warning": 850,
        "critical": 950,
        "weight": 10,
    },
}


def _average(values):
    return sum(values) / len(values) if values else 0.0


def _direction(recent_avg, previous_avg):
    if previous_avg is None:
        return "insufficient_data"

    tolerance = max(abs(previous_avg) * 0.05, 0.01)
    difference = recent_avg - previous_avg

    if difference > tolerance:
        return "increasing"
    if difference < -tolerance:
        return "decreasing"
    return "stable"


def build_trend_analysis(limit=100):
    limit = max(1, min(int(limit), 1000))
    records = get_telemetry_history(limit=limit)

    if not records:
        return {
            "status": "no_data",
            "mode": "RULE_BASED_ANALYSIS",
            "samples_analyzed": 0,
            "risk_score": 0,
            "risk_level": "unknown",
            "trends": {},
            "warnings": [],
            "recommendations": [
                "Generate telemetry before running analysis."
            ],
            "limitations": (
                "Analysis requires stored telemetry records."
            ),
        }

    # History is newest-first. Compare the newest half with
    # the older half, preserving chronological meaning.
    midpoint = len(records) // 2
    recent_records = records[:max(1, midpoint)]
    previous_records = records[max(1, midpoint):]

    trends = {}
    warnings = []
    recommendations = []
    risk_score = 0

    for metric, config in METRICS.items():
        latest = float(records[0][metric])

        recent_values = [
            float(record[metric]) for record in recent_records
        ]
        recent_avg = _average(recent_values)

        previous_avg = None
        if previous_records:
            previous_values = [
                float(record[metric]) for record in previous_records
            ]
            previous_avg = _average(previous_values)

        direction = _direction(recent_avg, previous_avg)

        if latest >= config["critical"]:
            severity = "critical"
            risk_score += config["weight"]
            warnings.append(
                f'{config["label"]} reached a critical value '
                f'of {latest:.2f} {config["unit"]}.'
            )
            recommendations.append(
                f'Investigate {config["label"].lower()} immediately.'
            )

        elif latest >= config["warning"]:
            severity = "warning"
            risk_score += config["weight"] // 2
            warnings.append(
                f'{config["label"]} is elevated at '
                f'{latest:.2f} {config["unit"]}.'
            )
            recommendations.append(
                f'Monitor {config["label"].lower()} and '
                "investigate the cause if it remains elevated."
            )

        else:
            severity = "normal"

        # A rising trend can be important even before a threshold
        # is crossed. This is a trend flag, not a prediction.
        if direction == "increasing" and severity == "normal":
            recommendations.append(
                f'{config["label"]} is trending upward; '
                "continue monitoring it."
            )

        trends[metric] = {
            "label": config["label"],
            "latest": round(latest, 2),
            "recent_average": round(recent_avg, 2),
            "previous_average": (
                round(previous_avg, 2)
                if previous_avg is not None
                else None
            ),
            "direction": direction,
            "severity": severity,
            "unit": config["unit"],
        }

    risk_score = min(100, risk_score)

    if risk_score >= 60:
        risk_level = "high"
    elif risk_score >= 25:
        risk_level = "medium"
    else:
        risk_level = "low"

    if not recommendations:
        recommendations.append(
            "Metrics are within configured thresholds. "
            "Continue routine monitoring."
        )

    # Avoid repeating identical recommendations.
    recommendations = list(dict.fromkeys(recommendations))

    return {
        "status": "ok",
        "mode": "RULE_BASED_ANALYSIS",
        "samples_analyzed": len(records),
        "latest_timestamp": records[0]["timestamp"],
        "risk_score": risk_score,
        "risk_level": risk_level,
        "trends": trends,
        "warnings": warnings,
        "recommendations": recommendations,
        "limitations": (
            "This analysis uses stored telemetry and fixed thresholds. "
            "Network traffic thresholds depend on the configured units. "
            "Synthetic demo data is not real infrastructure monitoring. "
            "Trend direction does not guarantee future failure."
        ),
    }
