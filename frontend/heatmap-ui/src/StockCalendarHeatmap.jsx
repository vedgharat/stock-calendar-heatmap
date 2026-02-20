import React, { useEffect, useMemo, useRef, useState } from "react";

/* ================= HELPERS ================= */

const toISO = (d) => d.toISOString().slice(0, 10);

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const COLOR_STEPS = [
  { label: "≤ -3%", color: "#991b1b", dark: "#ef4444" },
  { label: "-1%", color: "#ef4444", dark: "#f87171" },
  { label: "< 0%", color: "#fca5a5", dark: "#fca5a5" },
  { label: "0%", color: "#e5e7eb", dark: "#374151" }, // Neutral/Closed
  { label: "> 0%", color: "#86efac", dark: "#86efac" },
  { label: "+1%", color: "#22c55e", dark: "#4ade80" },
  { label: "≥ +3%", color: "#166534", dark: "#22c55e" },
];

function buildMonthWeeks(year, month) {
  const first = new Date(Date.UTC(year, month, 1));
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());

  const weeks = [];
  let cur = new Date(start);

  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cur));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    weeks.push(week);
  }

  return {
    name: first.toLocaleString("default", { month: "short" }),
    weeks,
  };
}

function pctChange(row) {
  if (!row || row.open <= 0) return null;
  return ((row.close - row.open) / row.open) * 100;
}

function getColor(p, isDark) {
  if (p === null) return isDark ? "#1f2937" : "#f3f4f6";
  if (p >= 3) return COLOR_STEPS[6][isDark ? "dark" : "color"];
  if (p >= 1) return COLOR_STEPS[5][isDark ? "dark" : "color"];
  if (p > 0) return COLOR_STEPS[4][isDark ? "dark" : "color"];
  if (p <= -3) return COLOR_STEPS[0][isDark ? "dark" : "color"];
  if (p <= -1) return COLOR_STEPS[1][isDark ? "dark" : "color"];
  return COLOR_STEPS[2][isDark ? "dark" : "color"];
}

/* ================= COMPONENT ================= */

export default function StockCalendarHeatmap() {
  const [symbol, setSymbol] = useState("AAPL");
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [data, setData] = useState([]);
  const [tooltip, setTooltip] = useState(null);
  const [isDark, setIsDark] = useState(true);

  const containerRef = useRef(null);

  /* ---------- FETCH DATA ---------- */
  useEffect(() => {
    if (!symbol.trim()) {
      setData([]);
      return;
    }
    // Mocking fetch or using your endpoint
    fetch(`http://127.0.0.1:8000/api/prices/${symbol}?year=${year}`)
      .then((r) => r.json())
      .then((arr) => setData(Array.isArray(arr) ? arr : []))
      .catch(() => setData([]));
  }, [symbol, year]);

  const dataMap = useMemo(() => {
    const m = new Map();
    data.forEach((r) => m.set(r.date, r));
    return m;
  }, [data]);

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => buildMonthWeeks(year, i)),
    [year]
  );

  /* ---------- LAYOUT ---------- */
  const [cell, setCell] = useState(14);
  const WEEK_GAP = 3;
  const MONTH_GAP = 12;

  useEffect(() => {
    function recalc() {
      const width = containerRef.current?.clientWidth || 800;
      const labelWidth = 40;
      const netWidth = width - labelWidth - (MONTH_GAP * 11);
      const monthWidth = netWidth / 12;
      const cellSize = Math.floor((monthWidth - (WEEK_GAP * 5)) / 6);
      setCell(Math.max(10, Math.min(16, cellSize)));
    }
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, []);

  const theme = {
    bg: isDark ? "#0f172a" : "#ffffff",
    text: isDark ? "#f8fafc" : "#1e293b",
    subtext: isDark ? "#94a3b8" : "#64748b",
    border: isDark ? "#334155" : "#e2e8f0",
  };

  return (
    <div 
      ref={containerRef} 
      style={{ 
        padding: "24px", 
        fontFamily: 'Inter, system-ui, sans-serif',
        backgroundColor: theme.bg,
        color: theme.text,
        borderRadius: "12px",
        transition: "background-color 0.3s ease",
        minWidth: "800px"
      }}
    >
      {/* HEADER & CONTROLS */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            style={{ 
              padding: "8px 12px", 
              borderRadius: "6px", 
              border: `1px solid ${theme.border}`,
              backgroundColor: isDark ? "#1e293b" : "#f8fafc",
              color: theme.text,
              fontWeight: 600,
              width: "100px"
            }}
          />
          <select 
            value={year} 
            onChange={(e) => setYear(+e.target.value)}
            style={{ 
              padding: "8px 12px", 
              borderRadius: "6px", 
              border: `1px solid ${theme.border}`,
              backgroundColor: isDark ? "#1e293b" : "#f8fafc",
              color: theme.text
            }}
          >
            {[0,1,2,3,4].map(i => {
              const y = new Date().getUTCFullYear() - i;
              return <option key={y} value={y}>{y}</option>;
            })}
          </select>
        </div>

        <button 
          onClick={() => setIsDark(!isDark)}
          style={{
            padding: "8px",
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            backgroundColor: theme.border,
            color: theme.text
          }}
        >
          {isDark ? "☀️" : "🌙"}
        </button>
      </div>

      {/* HEATMAP CONTAINER */}
      <div style={{ display: "flex", position: "relative" }}>
        
        {/* WEEKDAY LABELS */}
        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          justifyContent: "space-between", 
          paddingTop: "28px", // Offset for month names
          paddingRight: "8px",
          height: (cell * 7) + (WEEK_GAP * 12),
          fontSize: "10px",
          color: theme.subtext,
          fontWeight: 500
        }}>
          {WEEKDAYS.map((d, i) => (
            <div key={d} style={{ height: cell, display: i % 2 === 0 ? "none" : "flex", alignItems: "center" }}>
              {d}
            </div>
          ))}
        </div>

        {/* MONTHS GRID */}
        <div style={{ display: "flex", gap: MONTH_GAP, flex: 1 }}>
          {months.map((m, mi) => (
            <div key={mi} style={{ flex: 1 }}>
              <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "8px", textAlign: "center", color: theme.subtext }}>
                {m.name}
              </div>

              <div style={{ display: "flex", gap: WEEK_GAP }}>
                {m.weeks.map((week, wi) => (
                  <div key={wi} style={{ display: "flex", flexDirection: "column", gap: WEEK_GAP }}>
                    {week.map((day, di) => {
                      const inMonth = day.getUTCMonth() === mi && day.getUTCFullYear() === year;
                      const iso = toISO(day);
                      const row = dataMap.get(iso);
                      const p = pctChange(row);

                      return (
                        <div
                          key={di}
                          onMouseEnter={(e) => inMonth && showTooltip(e, iso, row, p)}
                          onMouseLeave={() => setTooltip(null)}
                          style={{
                            width: cell,
                            height: cell,
                            backgroundColor: inMonth ? getColor(p, isDark) : "transparent",
                            borderRadius: "2px",
                            transition: "transform 0.1s ease, filter 0.2s ease",
                            cursor: inMonth ? "pointer" : "default",
                            transform: tooltip?.date === iso ? "scale(1.3)" : "scale(1)",
                            zIndex: tooltip?.date === iso ? 10 : 1,
                            boxShadow: inMonth && !isDark ? "inset 0 0 0 1px rgba(0,0,0,0.03)" : "none"
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* COLOR LEGEND */}
      <div style={{ 
        marginTop: "32px", 
        display: "flex", 
        alignItems: "center", 
        gap: "12px",
        fontSize: "11px",
        color: theme.subtext
      }}>
        <span>Less</span>
        <div style={{ display: "flex", gap: "3px" }}>
          {COLOR_STEPS.map((step, i) => (
            <div 
              key={i} 
              title={step.label}
              style={{ width: cell, height: cell, backgroundColor: isDark ? step.dark : step.color, borderRadius: "2px" }} 
            />
          ))}
        </div>
        <span>More</span>
      </div>

      {/* TOOLTIP */}
      {tooltip && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x,
            top: tooltip.y,
            backgroundColor: isDark ? "#1e293b" : "white",
            color: theme.text,
            border: `1px solid ${theme.border}`,
            borderRadius: "8px",
            padding: "10px",
            fontSize: "12px",
            pointerEvents: "none",
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)",
            zIndex: 100,
            backdropFilter: "blur(4px)"
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: "4px", borderBottom: `1px solid ${theme.border}`, pb: "4px" }}>
            {new Date(tooltip.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "4px" }}>
            <span style={{ color: theme.subtext }}>Open:</span> <span>${tooltip.open}</span>
            <span style={{ color: theme.subtext }}>Close:</span> <span>${tooltip.close}</span>
            <span style={{ color: theme.subtext }}>Change:</span> 
            <span style={{ fontWeight: 600, color: tooltip.pct.startsWith('-') ? '#f87171' : '#4ade80' }}>
              {tooltip.pct}
            </span>
          </div>
        </div>
      )}
    </div>
  );

  function showTooltip(e, date, row, p) {
    setTooltip({
      x: e.clientX + 15,
      y: e.clientY - 20,
      date,
      open: row?.open?.toFixed(2) ?? "N/A",
      close: row?.close?.toFixed(2) ?? "N/A",
      pct: p !== null ? (p > 0 ? "+" : "") + p.toFixed(2) + "%" : "Market Closed",
    });
  }
}