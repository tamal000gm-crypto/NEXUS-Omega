
import { useCallback, useEffect, useRef, useState } from "react";

const API = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

const SCENARIOS = [
  { id: "traffic_spike", number: "01", label: "Traffic Spike", description: "Sudden increase in network throughput.", target: "1,400 units", icon: "↗" },
  { id: "cpu_overload", number: "02", label: "CPU Overload", description: "Compute utilization reaches its limit.", target: "100% CPU", icon: "▥" },
  { id: "service_latency", number: "03", label: "Service Latency", description: "Slow responses and elevated error rate.", target: "650 ms", icon: "◷" },
  { id: "memory_shortage", number: "04", label: "Memory Shortage", description: "Memory pressure threatens stability.", target: "100% memory", icon: "▤" },
];

const METRICS = [
  { key: "cpu_usage", label: "CPU", unit: "%", digits: 1 },
  { key: "memory_usage", label: "Memory", unit: "%", digits: 1 },
  { key: "network_traffic", label: "Network", unit: "units", digits: 2 },
  { key: "response_latency", label: "Latency", unit: "ms", digits: 1 },
  { key: "error_rate", label: "Error rate", unit: "%", digits: 2 },
];

const EMPTY_SUMMARY = {
  total_runs: 0,
  detected: 0,
  not_detected: 0,
  detection_rate: 0,
};

function fmt(value, digits = 1) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

function metricsOf(item) {
  return item?.metrics || item?.telemetry || {};
}

function analysisOf(item) {
  return item?.analysis || item || {};
}

function labelOf(item) {
  if (item?.scenario_label) return item.scenario_label;
  return SCENARIOS.find((s) => s.id === item?.scenario)?.label ||
    item?.scenario || "Simulation";
}

function severityClass(value) {
  const s = String(value || "low").toLowerCase();
  if (s === "critical" || s === "high") return "danger";
  if (s === "medium") return "warning";
  return "normal";
}

function errorMessage(err) {
  return err instanceof Error
    ? err.message
    : "An unexpected error occurred.";
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.detail || `API request failed (${response.status}).`
    );
  }

  return data;
}

export default function Simulator() {
  const [selected, setSelected] = useState("traffic_spike");
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);

  const requestLock = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  const loadHistory = useCallback(async () => {
    const data = await apiRequest("/api/simulations?limit=20");

    if (mounted.current) {
      setHistory(Array.isArray(data.records) ? data.records : []);
      setSummary({ ...EMPTY_SUMMARY, ...(data.summary || {}) });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initialLoad() {
      try {
        const data = await apiRequest("/api/simulations?limit=20");

        if (!cancelled) {
          setHistory(Array.isArray(data.records) ? data.records : []);
          setSummary({ ...EMPTY_SUMMARY, ...(data.summary || {}) });
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    }

    initialLoad();

    return () => {
      cancelled = true;
    };
  }, []);

  async function runOne(scenarioId = selected) {
    if (requestLock.current) return;

    requestLock.current = true;
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const data = await apiRequest(
        `/api/simulations/run?scenario=${encodeURIComponent(scenarioId)}`,
        { method: "POST" }
      );

      if (!mounted.current) return;

      setLatest(data);
      setNotice(`${labelOf(data)} simulation completed.`);
      await loadHistory();
    } catch (err) {
      if (mounted.current) setError(errorMessage(err));
    } finally {
      requestLock.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function runBatch() {
    if (requestLock.current) return;

    requestLock.current = true;
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const data = await apiRequest("/api/simulations/batch", {
        method: "POST",
      });

      if (!mounted.current) return;

      const results = Array.isArray(data.results) ? data.results : [];

      if (results.length) {
        setLatest(results[results.length - 1]);
      }

      setNotice(`${results.length} scenario simulations completed.`);
      await loadHistory();
    } catch (err) {
      if (mounted.current) setError(errorMessage(err));
    } finally {
      requestLock.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function refreshHistory() {
    if (historyLoading) return;

    setHistoryLoading(true);
    setError("");

    try {
      await loadHistory();
    } catch (err) {
      if (mounted.current) setError(errorMessage(err));
    } finally {
      if (mounted.current) setHistoryLoading(false);
    }
  }

  const analysis = analysisOf(latest);
  const metrics = metricsOf(latest);
  const severity = analysis.severity || latest?.severity || "low";
  const score = analysis.anomaly_score ?? latest?.anomaly_score ?? 0;
  const isAnomaly = analysis.is_anomaly ?? latest?.is_anomaly ?? false;

  const reasons = Array.isArray(
    analysis.reasons || latest?.reasons
  )
    ? (analysis.reasons || latest?.reasons || [])
    : [];

  const actions = Array.isArray(
    analysis.recommended_actions || latest?.recommended_actions
  )
    ? (analysis.recommended_actions || latest?.recommended_actions || [])
    : [];

  return (
    <section className="nexus-sim">
      <style>{`
        .nexus-sim{color:var(--text-primary,#e8edf7);font-family:inherit;margin:20px 0;width:100%}
        .nexus-sim *{box-sizing:border-box}
        .nexus-sim .muted{color:var(--text-secondary,#96a3b8)}
        .nexus-sim .panel{background:var(--panel-bg,#111827);border:1px solid var(--border-color,#283348);border-radius:14px;padding:18px;min-width:0}
        .nexus-sim .heading{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:16px}
        .nexus-sim .eyebrow{font-size:11px;letter-spacing:1.5px;font-weight:700;color:#9ba9c2;text-transform:uppercase}
        .nexus-sim h3{font-size:20px;margin:8px 0;font-weight:750}
        .nexus-sim p{font-size:13px;line-height:1.6;margin:0}
        .nexus-sim .badge{border:1px solid #365348;color:#83dfb5;border-radius:20px;padding:5px 9px;font-size:10px;font-weight:800}
        .nexus-sim .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
        .nexus-sim .card{border:1px solid var(--border-color,#283348);border-radius:11px;background:var(--card-bg,#151f30);color:inherit;padding:14px;text-align:left;cursor:pointer;min-width:0}
        .nexus-sim .card.selected{border-color:#9baeff;box-shadow:inset 0 0 0 1px #9baeff}
        .nexus-sim .card:disabled,.nexus-sim button:disabled{opacity:.55;cursor:not-allowed}
        .nexus-sim .num{color:#9daeff;font-size:11px;font-weight:800}
        .nexus-sim .symbol{font-size:22px;margin:12px 0}
        .nexus-sim .card h4{font-size:14px;margin:0 0 7px}
        .nexus-sim .card p{font-size:12px;color:var(--text-secondary,#96a3b8);min-height:55px}
        .nexus-sim .target{font-size:11px;font-weight:750;margin-top:12px}
        .nexus-sim .buttons{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:16px}
        .nexus-sim .btn{padding:10px 13px;border:1px solid #52617b;border-radius:8px;background:#202d42;color:#f4f6fc;font-size:12px;font-weight:750;cursor:pointer}
        .nexus-sim .btn.primary{background:#a6b5ff;color:#11182d;border-color:#a6b5ff}
        .nexus-sim .btn.secondary{background:transparent}
        .nexus-sim .notice{font-size:12px;color:#83dfb5;margin-top:12px}
        .nexus-sim .error{font-size:12px;color:#ffb4b4;border:1px solid #8e424b;border-radius:8px;padding:11px;margin-top:12px;overflow-wrap:anywhere}
        .nexus-sim .stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0}
        .nexus-sim .stat,.nexus-sim .metric{border:1px solid var(--border-color,#283348);border-radius:10px;background:var(--card-bg,#151f30);padding:13px;min-width:0}
        .nexus-sim .stat-label,.nexus-sim .metric-label{font-size:10px;color:var(--text-secondary,#96a3b8);margin-bottom:8px}
        .nexus-sim .stat-value{font-size:21px;font-weight:800}
        .nexus-sim .results{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:14px;margin-top:14px}
        .nexus-sim .status{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:15px 0}
        .nexus-sim .result-name{font-size:18px;font-weight:750;margin-bottom:5px}
        .nexus-sim .score{font-size:24px;font-weight:800;margin-top:6px}
        .nexus-sim .severity{display:inline-block;padding:5px 9px;border-radius:6px;font-size:10px;font-weight:850;text-transform:uppercase}
        .nexus-sim .danger{background:#4c252c;color:#ffb4b4}
        .nexus-sim .warning{background:#4a3921;color:#ffd28b}
        .nexus-sim .normal{background:#1d4038;color:#93e8c2}
        .nexus-sim .metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:14px}
        .nexus-sim .metric-value{font-size:17px;font-weight:800;overflow-wrap:anywhere}
        .nexus-sim .unit{font-size:10px;color:var(--text-secondary,#96a3b8);font-weight:500}
        .nexus-sim .subheading{font-size:13px;font-weight:750;margin:18px 0 8px}
        .nexus-sim ul{font-size:12px;line-height:1.8;padding-left:18px;overflow-wrap:anywhere}
        .nexus-sim .empty{font-size:12px;padding:12px 0;color:var(--text-secondary,#96a3b8)}
        .nexus-sim .table-wrap{overflow-x:auto;width:100%}
        .nexus-sim table{border-collapse:collapse;width:100%;font-size:11px;text-align:left;white-space:nowrap}
        .nexus-sim th{font-size:10px;color:var(--text-secondary,#96a3b8)}
        .nexus-sim th,.nexus-sim td{padding:11px 9px;border-bottom:1px solid var(--border-color,#283348)}
        .nexus-sim tbody tr{cursor:pointer}
        .nexus-sim tbody tr:hover{background:rgba(130,150,190,.07)}
        .nexus-sim .footnote{font-size:10px;line-height:1.7;color:var(--text-secondary,#96a3b8);margin-top:13px;overflow-wrap:anywhere}
        @media(max-width:850px){.nexus-sim .grid{grid-template-columns:repeat(2,minmax(0,1fr))}.nexus-sim .results{grid-template-columns:1fr}}
        @media(max-width:520px){.nexus-sim .grid,.nexus-sim .stats{grid-template-columns:repeat(2,minmax(0,1fr))}.nexus-sim .metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.nexus-sim .card p{min-height:0}}
      `}</style>

      <div className="heading">
        <div>
          <div className="eyebrow">Digital twin / simulation lab</div>
          <h3>Scenario Simulator</h3>
          <p className="muted">
            Run synthetic failure scenarios and inspect rule-based detection
            without touching a real server.
          </p>
        </div>
        <span className="badge">SAFE DEMO</span>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Total runs</div>
          <div className="stat-value">{summary.total_runs}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Detected</div>
          <div className="stat-value">{summary.detected}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Not detected</div>
          <div className="stat-value">{summary.not_detected}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Detection rate</div>
          <div className="stat-value">{fmt(summary.detection_rate, 1)}%</div>
        </div>
      </div>

      <div className="panel">
        <div className="eyebrow">01 / Scenario selection</div>
        <h3>Choose a scenario</h3>
        <p className="muted">Select one synthetic failure scenario to run.</p>

        <div className="grid" style={{ marginTop: 16 }}>
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`card ${selected === s.id ? "selected" : ""}`}
              onClick={() => setSelected(s.id)}
              disabled={busy}
              aria-pressed={selected === s.id}
            >
              <div className="num">{s.number}</div>
              <div className="symbol">{s.icon}</div>
              <h4>{s.label}</h4>
              <p>{s.description}</p>
              <div className="target">{s.target}</div>
            </button>
          ))}
        </div>

        <div className="buttons">
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => runOne(selected)}
          >
            {busy ? "Running…" : "Run selected scenario"}
          </button>
          <span className="muted">OR</span>
          <button
            type="button"
            className="btn secondary"
            disabled={busy}
            onClick={runBatch}
          >
            Run all 4 scenarios
          </button>
        </div>

        {notice && <div className="notice">{notice}</div>}
        {error && <div className="error">{error}</div>}
      </div>

      <div className="results">
        <div className="panel">
          <div className="eyebrow">02 / Detection output</div>
          <h3>Simulation result</h3>
          <p className="muted">Analysis for the most recent scenario.</p>

          {!latest ? (
            <div className="empty">
              Choose a scenario and run it to see the result.
            </div>
          ) : (
            <>
              <div className="status">
                <div>
                  <div className="result-name">{labelOf(latest)}</div>
                  <p className="muted">
                    {isAnomaly ? "anomaly_detected" : "normal"}
                  </p>
                  <div className="score">
                    {fmt(score, 0)} <span className="unit">/ 100</span>
                  </div>
                  <p className="muted">Rule-based anomaly score</p>
                </div>
                <span className={`severity ${severityClass(severity)}`}>
                  {severity}
                </span>
              </div>

              <div className="metrics">
                {METRICS.map((m) => (
                  <div className="metric" key={m.key}>
                    <div className="metric-label">{m.label}</div>
                    <div className="metric-value">
                      {fmt(metrics[m.key], m.digits)}{" "}
                      <span className="unit">{m.unit}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="subheading">Detection explanation</div>
              {reasons.length ? (
                <ul>
                  {reasons.map((r, i) => <li key={i}>{String(r)}</li>)}
                </ul>
              ) : (
                <p className="muted">No configured threshold was triggered.</p>
              )}

              <div className="subheading">Recommended actions</div>
              {actions.length ? (
                <ul>
                  {actions.map((a, i) => <li key={i}>{String(a)}</li>)}
                </ul>
              ) : (
                <p className="muted">Continue monitoring system metrics.</p>
              )}

              <div className="footnote">
                Run ID: {latest.simulation_id || latest.id || "—"}
                <br />
                Saved: {latest.timestamp
                  ? new Date(latest.timestamp).toLocaleString()
                  : "—"}
              </div>

              <div className="buttons">
                <button
                  type="button"
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => {
                    setLatest(null);
                    setNotice("");
                    setError("");
                  }}
                >
                  Clear result view
                </button>
              </div>
            </>
          )}
        </div>

        <div className="panel">
          <div className="eyebrow">03 / Persistence</div>
          <h3>Simulation history</h3>
          <p className="muted">Recent results saved in SQLite.</p>

          <div className="buttons">
            <button
              type="button"
              className="btn secondary"
              disabled={historyLoading || busy}
              onClick={refreshHistory}
            >
              {historyLoading ? "Refreshing…" : "Refresh history"}
            </button>
          </div>

          {!history.length ? (
            <div className="empty">
              No saved simulations yet. Run a scenario to create history.
            </div>
          ) : (
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>SCENARIO</th>
                    <th>RESULT</th>
                    <th>SEVERITY</th>
                    <th>SCORE</th>
                    <th>TIME</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item, index) => {
                    const a = analysisOf(item);
                    const sev = a.severity || item.severity || "low";
                    const sc = a.anomaly_score ?? item.anomaly_score ?? 0;
                    const detected = a.is_anomaly ?? item.is_anomaly ?? false;

                    return (
                      <tr
                        key={item.simulation_id || item.id || index}
                        onClick={() => setLatest(item)}
                        title="Click to view saved result"
                      >
                        <td>{labelOf(item)}</td>
                        <td>{detected ? "Detected" : "Normal"}</td>
                        <td>
                          <span className={`severity ${severityClass(sev)}`}>
                            {sev}
                          </span>
                        </td>
                        <td>{fmt(sc, 0)}/100</td>
                        <td>
                          {item.timestamp
                            ? new Date(item.timestamp).toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <p className="footnote">
        Synthetic scenarios use predefined metrics and rule-based thresholds.
        Detection rate is a demo statistic, not validated real-world model
        accuracy. Recommendations are advisory.
      </p>
    </section>
  );
}
