export function Sparkline({
  values,
  trend = "up",
}: {
  values: number[];
  trend?: "up" | "down" | "neutral";
}) {
  const data = values.length >= 2 ? values : [0, 0];
  const width = 70;
  const height = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * (width - 4) + 2;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const stroke =
    trend === "up" ? "#10b981" : trend === "down" ? "#f87171" : "#38bdf8";

  return (
    <svg className="sparkline-svg" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
