
import { useCallback, useEffect, useRef, useState } from "react";
import Simulator from "./Simulator";

const API = "http://127.0.0.1:8000";
const REFRESH_MS = 10000;

const styles = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #080d18; color: #e7edf8; font-family: Inter, Segoe UI, Arial, sans-serif; }
  button { cursor: pointer; font: inherit; }
  .nx { max-width: 1500px; margin: auto; padding: 24px; }
  .nx-header { display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap; margin-bottom:26px; }
  .nx-brand { font-size:25px; font-weight:800; letter-spacing:1px; }
  .nx-brand span { color:#45d6c5; }
  .nx-sub { color:#8998b3; font-size:13px; margin-top:6px; }
  .nx-status { display:flex; align-items:center; gap:9px; color:#a9b8ce; font-size:13px; }
  .nx-dot { width:8px; height:8px; border-radius:50%; background:#35d6a3; display:inline-block; }
  .nx-btn { background:#14253b; border:1px solid #29415e; border-radius:9px; color:#dce8fa; padding:10px 14px; }
  .nx-btn:disabled { opacity:.55; cursor:wait; }
  .nx-section-title { font-size:17px; font-weight:700; margin:26px 0 14px; }
  .nx-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:14px; }
  .nx-card { background:#101a2b; border:1px solid #1e3049; border-radius:13px; padding:18px; min-width:0; }
  .nx-label { color:#91a1bb; font-size:12px; text-transform:uppercase; letter-spacing:.7px; }
  .nx-value { font-size:29px; font-weight:750; margin:12px 0 8px; overflow-wrap:anywhere; }
  .nx-unit { color:#8fa0ba; font-size:12px; }
  .nx-bar { height:5px; background:#24344b; border-radius:8px; overflow:hidden; margin-top:14px; }
  .nx-bar > div { height:100%; background:#45d6c5; border-radius:8px; }
  .nx-columns { display:grid; grid-template-columns:minmax(0,1.25fr) minmax(0,1fr); gap:16px; }
  .nx-muted { color:#8fa0ba; font-size:13px; line-height:1.6; }
  .nx-chart { width:100%; height:190px; display:block; margin-top:14px; }
  .nx-table-wrap { overflow-x:auto; }
  .nx-table { width:100%; border-collapse:collapse; font-size:13px; white-space:nowrap; }
  .nx-table th,.nx-table td { padding:12px 10px; border-bottom:1px solid #243149; text-align:left; }
  .nx-table th { color:#91a1bb; font-weight:600; }
  .nx-pill { display:inline-block; padding:5px 9px; border-radius:20px; font-size:11px; background:#16372f; color:#6ce2bd; }
  .nx-error { border:1px solid #693c43; color:#ffb3b8; background:#281820; padding:12px; border-radius:9px; margin:14px 0; font-size:13px; }
  .nx-footer { margin:25px 0 5px; color:#697b96; font-size:12px; }
  @media(max-width:1050px) { .nx-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } }
  @media(max-width:700px) { .nx { padding:15px; } .nx-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .nx-columns { grid-template-columns:1fr; } .nx-value { font-size:24px; } }
  @media(max-width:390px) { .nx-grid { grid-template-columns:1fr; } }
`;

function number(value, digits = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

function MetricCard({ label, value, unit, percent }) {
  const width = Math.max(0, Math.min(100, Number(percent) || 0));

  return (
    <div className="nx-card">
      <div className="nx-label">{label}</div>
      <div className="nx-value">{value}</div>
      <div className="nx-unit">{unit}</div>
      <div className="nx-bar">
        <div style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function CpuChart({ records }) {
  const points = [...records]
    .reverse()
    .map((item) => Number(item.cpu_usage))
    .filter(Number.isFinite);

  if (points.length < 2) {
    return <p className="nx-muted">Collecting telemetry history…</p>;
  }

  const coords = points.map((value, index) => {
    const x = 8 + (index / (points.length - 1)) * 384;
    const y = 170 - (Math.max(0, Math.min(100, value)) / 100) * 150;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg
      className="nx-chart"
      viewBox="0 0 400 190"
      role="img"
      aria-label="CPU usage history chart"
    >
      {[20, 60, 100, 140, 180].map((y) => (
        <line key={y} x1="8" y1={y} x2="392" y2={y}
          stroke="#24344b" strokeWidth="1" />
      ))}
      <polyline
        points={coords}
        fill="none"
        stroke="#45d6c5"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function App() {
  const [telemetry, setTelemetry] = useState(null);
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const mounted = useRef(false);
  const requestInProgress = useRef(false);

  const refreshDashboard = useCallback(async (manual = false) => {
    if (requestInProgress.current) return;
    requestInProgress.current = true;

    if (manual && mounted.current) setRefreshing(true);

    try {
      const results = await Promise.allSettled([
        fetch(`${API}/api/telemetry`),
        fetch(`${API}/api/telemetry/history?limit=30`),
        fetch(`${API}/api/telemetry/summary`),
        fetch(`${API}/api/analytics/trends?limit=100`),
        fetch(`${API}/api/health`),
      ]);

      if (!mounted.current) return;

      const [liveResult, historyResult, summaryResult, analyticsResult, healthResult] = results;

      const readJson = async (result) => {
        if (result.status !== "fulfilled") {
          throw result.reason || new Error("Request failed");
        }
        if (!result.value.ok) {
          throw new Error(`API returned ${result.value.status}`);
        }
        return result.value.json();
      };

      let anySuccess = false;

      if (liveResult.status === "fulfilled" && liveResult.value.ok) {
        const liveData = await liveResult.value.json();
        const live = liveData?.telemetry || liveData?.data || liveData;
        if (live && typeof live === "object") {
          setTelemetry(live);
          anySuccess = true;
        }
      }

      if (historyResult.status === "fulfilled" && historyResult.value.ok) {
        const data = await historyResult.value.json();
        const records = Array.isArray(data) ? data : data?.records || data?.history || [];
        if (Array.isArray(records)) {
          setHistory(records);
          if (records.length > 0) {
            setTelemetry((current) => current || records[0]);
          }
          anySuccess = true;
        }
      }

      if (summaryResult.status === "fulfilled" && summaryResult.value.ok) {
        setSummary(await summaryResult.value.json());
        anySuccess = true;
      }

      if (analyticsResult.status === "fulfilled" && analyticsResult.value.ok) {
        setAnalytics(await analyticsResult.value.json());
        anySuccess = true;
      }

      if (healthResult.status === "fulfilled" && healthResult.value.ok) {
        anySuccess = true;
      }

      setConnected(anySuccess);
      setError(anySuccess ? "" : "Backend unreachable. Check that FastAPI is running on port 8000.");
      setLastUpdated(new Date());
    } catch (err) {
      if (mounted.current) {
        setConnected(false);
        setError(err?.message || "Could not refresh dashboard.");
      }
    } finally {
      requestInProgress.current = false;
      if (mounted.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refreshDashboard();

    const timer = window.setInterval(() => {
      refreshDashboard();
    }, REFRESH_MS);

    return () => {
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, [refreshDashboard]);

  const current = telemetry || history[0] || {};
  const cpu = Number(current.cpu_usage) || 0;
  const memory = Number(current.memory_usage) || 0;
  const network = Number(current.network_traffic) || 0;
  const latency = Number(current.response_latency) || 0;
  const errorRate = Number(current.error_rate) || 0;

  const analyticsText = analytics
    ? (analytics.summary || analytics.message || analytics.overall_status ||
       "Analytics available. Review the recommendations returned by the backend.")
    : "Waiting for analytics data…";

  const recommendations = Array.isArray(analytics?.recommendations)
    ? analytics.recommendations
    : Array.isArray(analytics?.analysis?.recommendations)
      ? analytics.analysis.recommendations
      : [];

  const risks = Array.isArray(analytics?.warnings)
    ? analytics.warnings
    : Array.isArray(analytics?.risks)
      ? analytics.risks
      : [];

  return (
    <>
      <style>{styles}</style>

      <main className="nx">
        <header className="nx-header">
          <div>
            <div className="nx-brand">NEXUS <span>Ω</span></div>
            <div className="nx-sub">Autonomous Enterprise Intelligence</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div className="nx-status">
              <span
                className="nx-dot"
                style={{ background: connected ? "#35d6a3" : "#ff7777" }}
              />
              {connected ? "Backend connected" : "Connection issue"}
            </div>
            <button
              className="nx-btn"
              onClick={() => refreshDashboard(true)}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing…" : "Refresh data"}
            </button>
          </div>
        </header>

        {error && <div className="nx-error">{error}</div>}

        <div className="nx-section-title">Live system telemetry</div>

        <section className="nx-grid">
          <MetricCard label="CPU Usage" value={`${number(cpu)}%`} unit="Processor utilization" percent={cpu} />
          <MetricCard label="Memory Usage" value={`${number(memory)}%`} unit="Memory utilization" percent={memory} />
          <MetricCard label="Network Traffic" value={number(network, 0)} unit="Traffic units" percent={Math.min(network / 15, 100)} />
          <MetricCard label="Response Latency" value={`${number(latency)} ms`} unit="Response time" percent={Math.min(latency / 10, 100)} />
          <MetricCard label="Error Rate" value={`${number(errorRate)}%`} unit="Observed errors" percent={errorRate * 10} />
        </section>

        <section className="nx-columns" style={{ marginTop: 18 }}>
          <div className="nx-card">
            <div className="nx-label">Performance history</div>
            <div className="nx-section-title" style={{ marginTop: 9 }}>CPU utilization</div>
            <CpuChart records={history} />
            <div className="nx-muted">
              {history.length} telemetry records loaded. Refreshing every 10 seconds.
            </div>
          </div>

          <div className="nx-card">
            <div className="nx-label">System intelligence</div>
            <div className="nx-section-title" style={{ marginTop: 9 }}>Risk analysis</div>
            <p className="nx-muted">{analyticsText}</p>

            {risks.length > 0 && (
              <>
                <div className="nx-label" style={{ marginTop: 16 }}>Warnings</div>
                <ul className="nx-muted">
                  {risks.slice(0, 5).map((item, index) => (
                    <li key={index}>
                      {typeof item === "string" ? item : item.message || item.description || JSON.stringify(item)}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {recommendations.length > 0 && (
              <>
                <div className="nx-label" style={{ marginTop: 16 }}>Recommendations</div>
                <ul className="nx-muted">
                  {recommendations.slice(0, 5).map((item, index) => (
                    <li key={index}>
                      {typeof item === "string" ? item : item.message || item.action || JSON.stringify(item)}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {summary && (
              <div className="nx-muted" style={{ marginTop: 16 }}>
                Total telemetry records:{" "}
                {summary.total_records ?? summary.count ?? summary.total ?? "—"}
              </div>
            )}
          </div>
        </section>

        <div className="nx-section-title">Recent telemetry records</div>

        <section className="nx-card nx-table-wrap">
          <table className="nx-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>CPU</th>
                <th>Memory</th>
                <th>Network</th>
                <th>Latency</th>
                <th>Error rate</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 10).map((item, index) => (
                <tr key={item.id ?? item.timestamp ?? index}>
                  <td>{item.timestamp ? String(item.timestamp).replace("T", " ").slice(0, 19) : "—"}</td>
                  <td>{number(item.cpu_usage)}%</td>
                  <td>{number(item.memory_usage)}%</td>
                  <td>{number(item.network_traffic, 0)}</td>
                  <td>{number(item.response_latency)} ms</td>
                  <td>{number(item.error_rate)}%</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan="6" className="nx-muted">Waiting for telemetry records…</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <div className="nx-section-title">Scenario simulation</div>

        <section className="nx-card">
          <Simulator />
        </section>

        <footer className="nx-footer">
          NEXUS Ω · Enterprise operations monitoring ·{" "}
          {lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : "Connecting…"}
          {" · "}
          <span className="nx-pill">{connected ? "ONLINE" : "CHECK CONNECTION"}</span>
        </footer>
      </main>
    </>
  );
}
