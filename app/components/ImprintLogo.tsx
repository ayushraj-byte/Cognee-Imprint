const TEAL = '#5EEAD4';
const YELLOW = '#FCD34D';
const DARK = '#0a1a18';

// 9-column × 7-row pixel-art grid (null = empty cell, 28px per tile)
const GRID: (string | null)[][] = [
  [null,   TEAL,   TEAL,   TEAL,   TEAL,   TEAL,   TEAL,   YELLOW, null  ],
  [TEAL,   TEAL,   TEAL,   TEAL,   TEAL,   TEAL,   YELLOW, YELLOW, YELLOW],
  [null,   TEAL,   DARK,   DARK,   TEAL,   DARK,   DARK,   YELLOW, null  ],
  [null,   TEAL,   DARK,   DARK,   YELLOW, DARK,   DARK,   YELLOW, null  ],
  [null,   TEAL,   TEAL,   YELLOW, YELLOW, YELLOW, YELLOW, YELLOW, null  ],
  [null,   null,   YELLOW, YELLOW, null,   YELLOW, YELLOW, null,   null  ],
  [null,   null,   YELLOW, YELLOW, null,   YELLOW, YELLOW, null,   null  ],
];

export default function ImprintLogo({ size = 28 }: { size?: number }) {
  const svgW = 252; // 9 × 28
  const svgH = 196; // 7 × 28
  const h = Math.round(size * svgH / svgW);

  return (
    <svg
      width={size}
      height={h}
      viewBox={`0 0 ${svgW} ${svgH}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
    >
      <defs>
        <linearGradient id="il-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="white" stopOpacity="0.35" />
          <stop offset="55%"  stopColor="white" stopOpacity="0.08" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      {GRID.flatMap((row, r) =>
        row.map((color, c) => {
          if (!color) return null;
          const x = c * 28;
          const y = r * 28;
          return (
            <g key={`${r}-${c}`}>
              {/* base tile */}
              <rect x={x} y={y} width={28} height={28} rx={3} ry={3} fill={color} />
              {/* glass shine */}
              <rect x={x} y={y} width={28} height={28} rx={3} ry={3} fill="url(#il-shine)" />
              {/* bottom shadow strip */}
              <rect x={x} y={y + 24} width={28} height={4} fill="rgba(0,0,0,0.18)" />
              {/* top highlight line */}
              <rect x={x + 2} y={y + 2} width={24} height={1} fill="rgba(255,255,255,0.45)" />
            </g>
          );
        })
      )}
    </svg>
  );
}
