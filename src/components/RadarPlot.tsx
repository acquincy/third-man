import { useState } from 'react';

export interface RadarAxisPoint {
  id: string;
  shortLabel: string;
  label: string;
  pctA: number | null;
  valA: string;
  pctB?: number | null;
  valB?: string;
}

interface RadarPlotProps {
  points: RadarAxisPoint[];
  nameA: string;
  nameB?: string;
  size?: number;
}

export function RadarPlot({ points, nameA, nameB, size = 320 }: RadarPlotProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const count = points.length;
  if (count < 3) return null;

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.34;
  const rings = [25, 50, 75, 100];

  const polarToXY = (index: number, pct: number) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const r = (Math.max(4, Math.min(100, pct)) / 100) * maxR;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  const buildPolygon = (selector: (p: RadarAxisPoint) => number | null | undefined) =>
    points
      .map((pt, i) => {
        const val = selector(pt);
        const { x, y } = polarToXY(i, val ?? 0);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  const polyA = buildPolygon((p) => p.pctA);
  const polyB = nameB ? buildPolygon((p) => p.pctB) : null;

  const activePoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full max-w-[340px] aspect-square flex items-center justify-center">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full h-full overflow-visible select-none"
          role="img"
          aria-label={`Percentile profile radar for ${nameA}${nameB ? ` compared with ${nameB}` : ''}`}
        >
          {/* Concentric percentile polygons */}
          {rings.map((ring) => {
            const ringPts = points
              .map((_, i) => {
                const { x, y } = polarToXY(i, ring);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .join(' ');
            return (
              <polygon
                key={ring}
                points={ringPts}
                fill="none"
                stroke={ring === 50 ? '#2A2E38' : '#1B1E25'}
                strokeWidth={ring === 50 ? 1 : 0.75}
                strokeDasharray={ring === 50 ? '3 3' : undefined}
              />
            );
          })}

          {/* Axis spokes */}
          {points.map((pt, i) => {
            const outer = polarToXY(i, 100);
            const isHovered = hoveredIndex === i;
            return (
              <line
                key={pt.id}
                x1={cx}
                y1={cy}
                x2={outer.x}
                y2={outer.y}
                stroke={isHovered ? '#525866' : '#1F2229'}
                strokeWidth={isHovered ? 1.25 : 0.75}
              />
            );
          })}

          {/* Player B polygon (drawn first so Player A emerald stroke stays crisp on top) */}
          {polyB && (
            <polygon
              points={polyB}
              fill="rgba(244, 244, 245, 0.08)"
              stroke="#F4F4F5"
              strokeWidth="1.5"
              strokeDasharray="4 2"
              strokeLinejoin="miter"
            />
          )}

          {/* Player A polygon */}
          <polygon
            points={polyA}
            fill="rgba(16, 185, 129, 0.14)"
            stroke="#10B981"
            strokeWidth="1.75"
            strokeLinejoin="miter"
          />

          {/* Interactive vertices & labels */}
          {points.map((pt, i) => {
            const posA = polarToXY(i, pt.pctA ?? 0);
            const posB = nameB ? polarToXY(i, pt.pctB ?? 0) : null;
            const labelPos = polarToXY(i, 124);
            const isHovered = hoveredIndex === i;

            return (
              <g
                key={pt.id}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="cursor-pointer"
              >
                {/* Hit zone */}
                <circle cx={labelPos.x} cy={labelPos.y} r="18" fill="transparent" />

                {posB && (
                  <circle
                    cx={posB.x}
                    cy={posB.y}
                    r={isHovered ? 3.5 : 2.25}
                    fill="#F4F4F5"
                    stroke="#09090B"
                    strokeWidth="1"
                  />
                )}
                <circle
                  cx={posA.x}
                  cy={posA.y}
                  r={isHovered ? 4 : 2.75}
                  fill="#10B981"
                  stroke="#09090B"
                  strokeWidth="1"
                />

                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="font-mono text-[10px] transition-colors"
                  fill={isHovered ? '#F4F4F5' : '#8A8F98'}
                >
                  {pt.shortLabel}
                </text>
              </g>
            );
          })}

          {/* Subtle center 50th label */}
          <text
            x={cx + 4}
            y={cy - maxR * 0.5 + 3}
            className="font-mono text-[9px]"
            fill="#525866"
          >
            50
          </text>
        </svg>
      </div>

      {/* Fixed-height inspection readout (zero layout shift on hover) */}
      <div className="w-full mt-2 pt-3 border-t border-[#1F2229] min-h-[48px] flex items-center justify-between gap-4 text-xs">
        {activePoint ? (
          <>
            <span className="text-[#F4F4F5] font-medium truncate">{activePoint.label}</span>
            <div className="flex items-center gap-4 font-mono tabular-nums shrink-0">
              <span className="text-[#10B981]">
                {activePoint.valA} ({activePoint.pctA ?? '—'}p)
              </span>
              {nameB && (
                <span className="text-[#F4F4F5]">
                  {activePoint.valB} ({activePoint.pctB ?? '—'}p)
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="w-full flex items-center justify-between text-[#8A8F98]">
            <span>Hover an axis to inspect values</span>
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className="flex items-center gap-1.5 text-[#10B981]">
                <span className="inline-block w-3 h-[2px] bg-[#10B981]" />
                {nameA}
              </span>
              {nameB && (
                <span className="flex items-center gap-1.5 text-[#F4F4F5]">
                  <span className="inline-block w-3 h-[2px] border-t border-dashed border-[#F4F4F5]" />
                  {nameB}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
