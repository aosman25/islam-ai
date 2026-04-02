"use client";

import { cn } from "@/lib/utils";

interface GeometricBotIconProps {
  isAnimating?: boolean;
  size?: number;
  className?: string;
}

/**
 * An Islamic-geometric bot avatar that animates during LLM generation.
 * Multi-layered design: outer circle frame, two 8-pointed star layers,
 * petal ring, interlocking kite shapes, and a center rosette.
 */
export function GeometricBotIcon({
  isAnimating = false,
  size = 40,
  className,
}: GeometricBotIconProps) {
  const cx = 50;
  const cy = 50;

  // Helper: point on a circle
  const pt = (angle: number, r: number) => ({
    x: cx + r * Math.cos((angle * Math.PI) / 180),
    y: cy + r * Math.sin((angle * Math.PI) / 180),
  });

  // 8-pointed star path (two squares overlaid)
  const starPath = (r: number) => {
    const points = Array.from({ length: 8 }, (_, i) => {
      const angle = i * 45 - 90;
      const radius = i % 2 === 0 ? r : r * 0.5;
      return pt(angle, radius);
    });
    return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + "Z";
  };

  // Kite / diamond shape between two radii
  const kitePath = (angle: number) => {
    const outer = pt(angle, 38);
    const left = pt(angle - 12, 26);
    const inner = pt(angle, 18);
    const right = pt(angle + 12, 26);
    return `M${outer.x},${outer.y} L${left.x},${left.y} L${inner.x},${inner.y} L${right.x},${right.y}Z`;
  };

  return (
    <div
      className={cn("flex-shrink-0 flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="text-primary"
      >
        {/* Layer 1: Outer circle frame */}
        <circle
          cx={cx}
          cy={cy}
          r={46}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.2}
          opacity={0.3}
          className={cn(
            isAnimating && "animate-[geo-breathe_3s_ease-in-out_infinite]"
          )}
        />
        <circle
          cx={cx}
          cy={cy}
          r={42}
          fill="none"
          stroke="currentColor"
          strokeWidth={0.8}
          opacity={0.2}
          strokeDasharray="4 3"
          className={cn(
            isAnimating && "animate-[geo-spin_12s_linear_infinite]"
          )}
          style={{ transformOrigin: "50px 50px" }}
        />

        {/* Layer 2: Outer 8-pointed star — slow rotation */}
        <g
          className={cn(
            isAnimating && "animate-[geo-spin_8s_linear_infinite]"
          )}
          style={{ transformOrigin: "50px 50px" }}
        >
          <path
            d={starPath(40)}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinejoin="round"
            opacity={0.35}
          />
          {/* Radial tick marks at each star point */}
          {Array.from({ length: 8 }, (_, i) => {
            const angle = i * 45 - 90;
            const p1 = pt(angle, 38);
            const p2 = pt(angle, 44);
            return (
              <line
                key={`tick-${i}`}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="currentColor"
                strokeWidth={1}
                opacity={0.25}
              />
            );
          })}
        </g>

        {/* Layer 3: Kite / interlocking diamond ring */}
        <g
          className={cn(
            isAnimating && "animate-[geo-spin-reverse_6s_linear_infinite]"
          )}
          style={{ transformOrigin: "50px 50px" }}
        >
          {Array.from({ length: 8 }, (_, i) => (
            <path
              key={`kite-${i}`}
              d={kitePath(i * 45 - 90)}
              fill="currentColor"
              opacity={0.1}
              stroke="currentColor"
              strokeWidth={0.8}
              strokeLinejoin="round"
            />
          ))}
        </g>

        {/* Layer 4: Inner overlapping squares (classic 8-pointed star) */}
        <g
          className={cn(
            isAnimating && "animate-[geo-spin_4s_linear_infinite]"
          )}
          style={{ transformOrigin: "50px 50px" }}
        >
          <rect
            x={cx - 16}
            y={cy - 16}
            width={32}
            height={32}
            rx={2}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            transform={`rotate(45 ${cx} ${cy})`}
            className={cn(
              isAnimating && "animate-[geo-breathe_2s_ease-in-out_infinite]"
            )}
          />
          <rect
            x={cx - 16}
            y={cy - 16}
            width={32}
            height={32}
            rx={2}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className={cn(
              isAnimating && "animate-[geo-breathe_2s_ease-in-out_infinite_0.5s]"
            )}
          />
        </g>

        {/* Layer 5: Petal rosette — counter-rotates */}
        <g
          className={cn(
            isAnimating && "animate-[geo-spin-reverse_10s_linear_infinite]"
          )}
          style={{ transformOrigin: "50px 50px" }}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <ellipse
              key={`petal-${i}`}
              cx={cx}
              cy={cy - 12}
              rx={2.2}
              ry={6}
              fill="currentColor"
              opacity={0.3}
              transform={`rotate(${i * 30} ${cx} ${cy})`}
            />
          ))}
        </g>

        {/* Layer 6: Inner circle ring */}
        <circle
          cx={cx}
          cy={cy}
          r={8}
          fill="none"
          stroke="currentColor"
          strokeWidth={0.8}
          opacity={0.4}
        />

        {/* Layer 7: Center dot — pulses */}
        <circle
          cx={cx}
          cy={cy}
          r={isAnimating ? 4 : 3.5}
          fill="currentColor"
          className={cn(
            isAnimating && "animate-[geo-pulse_1.5s_ease-in-out_infinite]"
          )}
        />

        {/* Corner accent dots on the inner circle */}
        {Array.from({ length: 8 }, (_, i) => {
          const p = pt(i * 45, 8);
          return (
            <circle
              key={`dot-${i}`}
              cx={p.x}
              cy={p.y}
              r={1.2}
              fill="currentColor"
              opacity={0.5}
            />
          );
        })}
      </svg>
    </div>
  );
}
