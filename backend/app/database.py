
import sqlite3
from pathlib import Path

DB_PATH = (
    Path(__file__).resolve().parent.parent
    / "nexus_telemetry.db"
)


def get_connection():
    connection = sqlite3.connect(str(DB_PATH), timeout=10)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS telemetry (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                cpu_usage REAL NOT NULL,
                memory_usage REAL NOT NULL,
                network_traffic REAL NOT NULL,
                response_latency REAL NOT NULL,
                error_rate REAL NOT NULL,
                mode TEXT NOT NULL
            )
        """)

        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp
            ON telemetry(timestamp)
        """)


def save_telemetry(record):
    required_fields = (
        "timestamp",
        "cpu_usage",
        "memory_usage",
        "network_traffic",
        "response_latency",
        "error_rate",
    )

    missing = [key for key in required_fields if key not in record]

    if missing:
        raise ValueError(
            f"Missing telemetry fields: {', '.join(missing)}"
        )

    with get_connection() as connection:
        cursor = connection.execute("""
            INSERT INTO telemetry (
                timestamp,
                cpu_usage,
                memory_usage,
                network_traffic,
                response_latency,
                error_rate,
                mode
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            record["timestamp"],
            record["cpu_usage"],
            record["memory_usage"],
            record["network_traffic"],
            record["response_latency"],
            record["error_rate"],
            record.get("mode", "SYNTHETIC_DEMO"),
        ))

        return cursor.lastrowid


def get_telemetry_history(limit=60):
    limit = max(1, min(int(limit), 1000))

    with get_connection() as connection:
        rows = connection.execute("""
            SELECT
                timestamp,
                cpu_usage,
                memory_usage,
                network_traffic,
                response_latency,
                error_rate,
                mode
            FROM telemetry
            ORDER BY id DESC
            LIMIT ?
        """, (limit,)).fetchall()

    return [dict(row) for row in rows]


def get_telemetry_summary():
    metrics = [
        "cpu_usage",
        "memory_usage",
        "network_traffic",
        "response_latency",
        "error_rate",
    ]

    with get_connection() as connection:
        count = connection.execute(
            "SELECT COUNT(*) FROM telemetry"
        ).fetchone()[0]

        if count == 0:
            return {
                "samples": 0,
                "message": "No telemetry records available yet.",
            }

        summary = {"samples": count}

        for metric in metrics:
            row = connection.execute(f"""
                SELECT
                    (
                        SELECT {metric}
                        FROM telemetry
                        ORDER BY id DESC
                        LIMIT 1
                    ) AS latest,
                    AVG({metric}) AS average,
                    MIN({metric}) AS minimum,
                    MAX({metric}) AS maximum
                FROM telemetry
            """).fetchone()

            summary[metric] = {
                "latest": round(row["latest"], 2),
                "average": round(row["average"], 2),
                "minimum": round(row["minimum"], 2),
                "maximum": round(row["maximum"], 2),
            }

    return summary


initialize_database()
