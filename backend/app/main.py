
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.telemetry import (
    generate_telemetry,
    get_telemetry_history,
    get_telemetry_summary,
)
from app.analytics import build_trend_analysis
from app.simulation import (
    SCENARIOS,
    analyze_scenario,
    get_simulation_history,
    get_simulation_summary,
)


app = FastAPI(
    title="NEXUS Ω Enterprise Intelligence API",
    description=(
        "Enterprise telemetry, trend analysis, "
        "risk assessment, predictive intelligence, "
        "and safe synthetic scenario simulation."
    ),
    version="4.1.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5176",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "name": "NEXUS Ω Enterprise Intelligence API",
        "version": "4.1.0",
        "status": "online",
        "docs": "/docs",
        "features": [
            "Telemetry generation",
            "SQLite persistence",
            "Telemetry history",
            "Metric summaries",
            "Trend and risk analysis",
            "Predictive intelligence",
            "Synthetic scenario simulation",
            "Simulation history",
        ],
    }


@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "NEXUS Ω API",
        "version": "4.1.0",
    }


# TELEMETRY

@app.get("/api/telemetry")
def telemetry():
    return generate_telemetry()


@app.get("/api/telemetry/batch")
def telemetry_batch(
    count: int = Query(default=10, ge=1, le=100),
):
    records = [
        generate_telemetry()
        for _ in range(count)
    ]

    return {
        "count": len(records),
        "records": records,
    }


@app.get("/api/telemetry/history")
def telemetry_history(
    limit: int = Query(default=60, ge=1, le=1000),
):
    records = get_telemetry_history(limit=limit)

    return {
        "count": len(records),
        "records": records,
    }


@app.get("/api/telemetry/summary")
def telemetry_summary():
    return get_telemetry_summary()


# ANALYTICS

@app.get("/api/analytics/trends")
def analytics_trends(
    limit: int = Query(default=100, ge=1, le=1000),
):
    return build_trend_analysis(limit=limit)


@app.get("/api/predictions")
def predictions():
    try:
        from app.prediction import build_predictions
        return build_predictions()

    except ImportError:
        return {
            "status": "unavailable",
            "message": (
                "The prediction module or one of its "
                "dependencies is not available."
            ),
        }


# SIMULATION

@app.get("/api/simulations/scenarios")
def simulation_scenarios():
    return {
        "count": len(SCENARIOS),
        "scenarios": [
            {"id": key, **value}
            for key, value in SCENARIOS.items()
        ],
    }


@app.post("/api/simulations/run")
def run_simulation(
    scenario: str = Query(...),
):
    try:
        return analyze_scenario(scenario)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


@app.post("/api/simulations/batch")
def run_simulation_batch():
    results = [
        analyze_scenario(key)
        for key in SCENARIOS
    ]

    return {
        "count": len(results),
        "results": results,
        "summary": get_simulation_summary(),
    }


@app.get("/api/simulations")
def simulation_history(
    limit: int = Query(default=20, ge=1, le=200),
):
    records = get_simulation_history(limit=limit)

    return {
        "count": len(records),
        "records": records,
        "summary": get_simulation_summary(),
    }


@app.get("/api/simulations/summary")
def simulation_summary():
    return get_simulation_summary()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
    )
