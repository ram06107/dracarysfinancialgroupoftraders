export type DemoChartVariant = "range" | "rejection" | "unresolved" | "desk" | "breakout";

const chartShapes: Record<DemoChartVariant, { marker: number; candles: [number, number, number, number][] }> = {
  range: { marker: 119, candles: [[150,132,113,165],[132,141,119,154],[141,117,106,149],[117,125,110,136],[125,138,116,146],[138,124,115,151],[124,128,108,139],[128,112,101,139],[112,121,99,130],[121,109,97,134],[109,117,103,126],[117,104,94,128],[104,111,91,122],[111,103,92,119],[103,107,88,118],[107,99,86,115]] },
  rejection: { marker: 91, candles: [[155,143,131,170],[143,129,119,151],[129,116,108,139],[116,121,101,132],[121,104,94,130],[104,99,82,112],[99,112,89,122],[112,126,104,137],[126,133,115,143],[133,119,109,145],[119,125,105,134],[125,111,98,134],[111,118,103,128],[118,107,96,129],[107,114,98,122],[114,101,91,124]] },
  unresolved: { marker: 126, candles: [[136,129,116,149],[129,141,119,154],[141,132,121,150],[132,145,125,158],[145,136,128,156],[136,122,112,149],[122,131,113,141],[131,119,107,142],[119,126,108,137],[126,114,102,139],[114,122,104,130],[122,131,111,143],[131,120,109,140],[120,127,110,138],[127,117,103,139],[117,124,105,133]] },
  desk: { marker: 110, candles: [[160,145,132,173],[145,151,134,161],[151,131,122,160],[131,140,120,149],[140,115,103,150],[115,121,98,132],[121,108,93,132],[108,119,101,129],[119,101,91,129],[101,108,88,117],[108,116,99,124],[116,100,89,126],[100,111,94,120],[111,105,91,119],[105,110,95,116],[110,98,86,119]] },
  breakout: { marker: 142, candles: [[159,150,139,170],[150,156,142,164],[156,143,135,163],[143,151,132,158],[151,136,126,160],[136,144,126,151],[144,131,120,153],[131,139,118,149],[139,122,110,151],[122,129,108,138],[129,112,102,139],[112,117,97,126],[117,96,87,127],[96,103,83,113],[103,88,78,114],[88,94,75,103]] },
};

export function DemoChartImage({ variant, caption = "ILLUSTRATIVE CHART · NOT LIVE MARKET DATA" }: { variant: DemoChartVariant; caption?: string }) {
  const shape = chartShapes[variant];
  const candles = shape.candles;

  return (
    <figure className={`demo-chart-image demo-chart-${variant}`} role="img" aria-label={`${caption}. Fictional candlestick illustration.`}>
      <svg viewBox="0 0 640 236" aria-hidden="true" focusable="false">
        <rect x="0" y="0" width="640" height="236" className="chart-image-surface" />
        {[32, 70, 108, 146, 184].map((y) => <line key={`h-${y}`} x1="54" y1={y} x2="598" y2={y} className="chart-image-grid" />)}
        {[54, 190, 326, 462, 598].map((x) => <line key={`v-${x}`} x1={x} y1="18" x2={x} y2="194" className="chart-image-grid chart-image-grid-vertical" />)}
        <line x1="54" x2="598" y1={shape.marker} y2={shape.marker} className="chart-image-level" />
        {candles.map(([open, close, high, low], index) => {
          const x = 67 + index * 32.3;
          const up = close < open;
          const top = Math.min(open, close);
          const height = Math.max(5, Math.abs(close - open));
          return <g key={`${variant}-${index}`} className={up ? "chart-candle-up" : "chart-candle-down"}>
            <line x1={x + 7} x2={x + 7} y1={high} y2={low} className="chart-candle-wick" />
            <rect x={x} y={top} width="14" height={height} rx="1" className="chart-candle-body" />
          </g>;
        })}
        <text x="55" y="216" className="chart-image-axis">MON</text>
        <text x="185" y="216" className="chart-image-axis">TUE</text>
        <text x="322" y="216" className="chart-image-axis">WED</text>
        <text x="457" y="216" className="chart-image-axis">THU</text>
        <text x="576" y="216" className="chart-image-axis">FRI</text>
        <text x="592" y="15" textAnchor="end" className="chart-image-stamp">SAMPLE</text>
      </svg>
      <figcaption><span className="chart-image-key"><i />Illustrative price path</span><span>{caption}</span></figcaption>
    </figure>
  );
}
