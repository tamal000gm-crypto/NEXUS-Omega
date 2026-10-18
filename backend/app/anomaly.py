
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

FEATURES = [
    "cpu_usage",
    "memory_usage",
    "network_traffic",
    "response_latency",
    "error_rate",
]

rng = np.random.default_rng(42)

normal_data = np.column_stack([
    np.clip(rng.normal(45, 12, 1000), 5, 75),
    np.clip(rng.normal(60, 10, 1000), 20, 80),
    np.clip(rng.normal(450, 120, 1000), 50, 800),
    np.clip(rng.normal(90, 25, 1000), 10, 180),
    np.clip(rng.normal(1.0, 0.6, 1000), 0, 3),
])

model = make_pipeline(
    StandardScaler(),
    IsolationForest(
        n_estimators=150,
        contamination=0.05,
        random_state=42,
    ),
)
model.fit(normal_data)


def detect_anomaly(record: dict) -> dict:
    values = np.array([
        [float(record[name]) for name in FEATURES]
    ])

    prediction = int(model.predict(values)[0])
    raw_score = float(model.decision_function(values)[0])

    checks = [
        (
            "cpu_usage", 85, 95,
            "CPU utilization is unusually high.",
            "Inspect CPU-intensive processes and consider scaling compute capacity.",
        ),
        (
            "memory_usage", 85, 95,
            "Memory utilization is unusually high.",
            "Inspect memory-consuming processes and check for memory leaks.",
        ),
        (
            "network_traffic", 800, 1200,
            "Network traffic is unusually high.",
            "Inspect traffic patterns and investigate unexpected request spikes.",
        ),
        (
            "response_latency", 200, 500,
            "Service response latency is unusually high.",
            "Inspect slow requests, database queries, and downstream dependencies.",
        ),
        (
            "error_rate", 5, 10,
            "Application error rate is unusually high.",
            "Review application logs and investigate recurring failed requests.",
        ),
    ]

    reasons = []
    actions = []
    triggered = []
    critical = False

    for metric, threshold, critical_threshold, reason, action in checks:
        value = float(record[metric])

        if value >= threshold:
            triggered.append(metric)
            reasons.append(reason)
            actions.append(action)

        if value >= critical_threshold:
            critical = True

    is_anomaly = prediction == -1 or bool(triggered)

    if is_anomaly:
        severity = (
            "HIGH"
            if critical or len(triggered) >= 2
            else "MEDIUM"
        )

        if not reasons:
            reasons.append(
                "Isolation Forest detected an unusual combination "
                "of metrics compared with its synthetic training baseline."
            )
            actions.append(
                "Compare this sample with recent telemetry and investigate "
                "which metrics changed most."
            )

        status = "ANOMALY"
    else:
        severity = "LOW"
        status = "NORMAL"
        reasons.append(
            "No configured threshold was exceeded and the model "
            "classified the telemetry as normal."
        )
        actions.append(
            "Continue monitoring and investigate if metrics trend upward."
        )

    return {
        "is_anomaly": is_anomaly,
        "status": status,
        "severity": severity,
        "anomaly_score": round(-raw_score, 4),
        "model": "IsolationForest",
        "mode": "SYNTHETIC_DEMO",
        "reasons": reasons,
        "recommended_actions": actions,
    }
