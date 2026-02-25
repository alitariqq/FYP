import "../styles/LULCPanel.css";
import { useState, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from "recharts";

export default function LULCPanel({
  panelOpen,
  setPanelOpen,
  result,
  selectedYearIndex,
  setSelectedYearIndex,
}) {
  const [showConclusion, setShowConclusion] = useState(false);
  const [chartType, setChartType] = useState("line");
  const [selectedClass, setSelectedClass] = useState("ALL");

  const years = result?.year_results || [];

  const safeIndex =
    typeof selectedYearIndex === "number" && selectedYearIndex < years.length
      ? selectedYearIndex
      : 0;

  const yearData = years[safeIndex];

  //metrics

  const metrics = useMemo(() => {
    if (!yearData?.metrics_json) return null;
    return typeof yearData.metrics_json === "string"
      ? JSON.parse(yearData.metrics_json)
      : yearData.metrics_json;
  }, [yearData]);

  const conclusion =
    result?.conclusion?.metrics_json
      ? typeof result.conclusion.metrics_json === "string"
        ? JSON.parse(result.conclusion.metrics_json)
        : result.conclusion.metrics_json
      : null;

  //donut center total

  const totalArea = useMemo(() => {
    if (!metrics?.distribution) return 0;
    return metrics.distribution.reduce((a, b) => a + b.area_km2, 0);
  }, [metrics]);

  //trend data

  const trendData = useMemo(() => {
    if (!years.length) return [];

    return years.map((y) => {
      const m =
        typeof y.metrics_json === "string"
          ? JSON.parse(y.metrics_json)
          : y.metrics_json;

      const row = { year: y.year };
      m?.distribution?.forEach((d) => {
        row[d.class] = d.area_km2;
      });
      return row;
    });
  }, [years]);

  const classes =
    metrics?.distribution?.map((d) => ({
      name: d.class,
      color: d.color,
    })) || [];

  if (!result || !metrics) return null;


  return (
    <div className={`lulc-panel ${panelOpen ? "open" : ""}`}>
      {panelOpen && (
        <button className="lulc-close-btn" onClick={() => setPanelOpen(false)}>
          ✕
        </button>
      )}

      <div className="lulc-header">
        <h3 className="lulc-title">LULC Analysis</h3>
      </div>

      <div className="lulc-content">

        {/* CONTROLS  */}
        <div className="lulc-controls">

          {/* YEAR SELECTOR (hidden in conclusion) */}
          {!showConclusion && (
            <select
              value={safeIndex}
              onChange={(e) =>
                setSelectedYearIndex(Number(e.target.value))
              }
            >
              {years.map((y, idx) => (
                <option key={y.year} value={idx}>
                  {y.year}
                </option>
              ))}
            </select>
          )}

          {/* button becomes Back automatically */}
          <button onClick={() => setShowConclusion(!showConclusion)}>
            {showConclusion ? "Back" : "Conclusion"}
          </button>
        </div>

        {/* YEAR VIEW */}

        {!showConclusion && (
          <>
            <Card title="Distribution">

              <div className="pie-wrapper">

                {/* center label */}
                <div className="pie-center">
                  <div className="pie-total">
                    {totalArea.toFixed(0)}
                  </div>
                  <div className="pie-sub">km² total</div>
                </div>

                <PieChart width={340} height={340}>
                  <Pie
                    data={metrics.distribution}
                    dataKey="area_km2"
                    nameKey="class"
                    innerRadius={95}
                    outerRadius={135}
                    paddingAngle={1}
                    cornerRadius={5}
                    stroke="none"
                  >
                    {metrics.distribution.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </div>

              <div className="pie-legend">
                {metrics.distribution.map((d) => (
                  <div key={d.class} className="legend-item">
                    <span
                      className="legend-color"
                      style={{ background: d.color }}
                    />
                    {d.class}
                  </div>
                ))}
              </div>
            </Card>

            {metrics?.kpis && (
              <Card title="KPIs">
                <MetricGrid data={metrics.kpis} />
              </Card>
            )}

            {metrics?.insights && (
              <Card title="Insights">
                <MetricGrid data={metrics.insights} />
              </Card>
            )}
          </>
        )}

        {/* CONCLUSION VIEW */}

        {showConclusion && (
          <>
            <div className="chart-options">
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                <option value="ALL">All Classes</option>
                {classes.map((c) => (
                  <option key={c.name}>{c.name}</option>
                ))}
              </select>

              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value)}
              >
                <option value="line">Line</option>
                <option value="bar">Histogram</option>
              </select>
            </div>

            <Card title="Trends">

              {chartType === "line" ? (
                <LineChart width={320} height={260} data={trendData}>
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />

                  {(selectedClass === "ALL"
                    ? classes
                    : classes.filter((c) => c.name === selectedClass)
                  ).map((c) => (
                    <Line
                      key={c.name}
                      type="monotone"
                      dataKey={c.name}
                      stroke={c.color}
                      strokeWidth={3}
                      dot={false}
                    />
                  ))}
                </LineChart>
              ) : (
                <BarChart width={320} height={260} data={trendData}>
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />

                  {(selectedClass === "ALL"
                    ? classes
                    : classes.filter((c) => c.name === selectedClass)
                  ).map((c) => (
                    <Bar key={c.name} dataKey={c.name} fill={c.color} radius={[6,6,0,0]} />
                  ))}
                </BarChart>
              )}
            </Card>

            {conclusion?.headline_stats && (
              <Card title="Headline Stats">
                <MetricGrid data={conclusion.headline_stats} />
              </Card>
            )}

            {result.conclusion?.conclusion_text && (
              <Card title="Summary">
                <p className="summary">
                  {result.conclusion.conclusion_text}
                </p>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="lulc-card">
      <h4>{title}</h4>
      {children}
    </div>
  );
}

function MetricGrid({ data }) {
  return (
    <div className="metric-grid">
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="metric-card">
          <span className="metric-label">{k.replace(/_/g, " ")}</span>
          <div className="metric-value">
            {typeof v === "number" ? v.toLocaleString() : v}
          </div>
        </div>
      ))}
    </div>
  );
}
