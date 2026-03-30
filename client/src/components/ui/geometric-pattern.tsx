"use client";

export function GeometricPattern() {
  const S = 120;
  const H = S / 2;
  const r1 = S * 0.42;
  const r2 = S * 0.18;
  const starPoints: string[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i - Math.PI / 2;
    const r = i % 2 === 0 ? r1 : r2;
    starPoints.push(`${H + r * Math.cos(angle)},${H + r * Math.sin(angle)}`);
  }

  const petalR = S * 0.13;
  const petalPaths: string[] = [];
  for (let i = 0; i < 8; i++) {
    const a1 = (Math.PI / 4) * i - Math.PI / 8;
    const a2 = (Math.PI / 4) * i + Math.PI / 8;
    const x1 = H + petalR * 1.8 * Math.cos(a1);
    const y1 = H + petalR * 1.8 * Math.sin(a1);
    const x2 = H + petalR * 1.8 * Math.cos(a2);
    const y2 = H + petalR * 1.8 * Math.sin(a2);
    petalPaths.push(`M${H},${H} L${x1},${y1} A${petalR},${petalR} 0 0,1 ${x2},${y2} Z`);
  }

  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 960 960"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="islamic-geo" width={S} height={S} patternUnits="userSpaceOnUse">
          <polygon points={starPoints.join(" ")} stroke="currentColor" strokeWidth="0.6" fill="none" />
          <polygon points={starPoints.join(" ")} stroke="currentColor" strokeWidth="0.3" fill="none" transform={`rotate(22.5 ${H} ${H})`} />
          {petalPaths.map((d, i) => (
            <path key={i} d={d} stroke="currentColor" strokeWidth="0.35" fill="none" />
          ))}
          <circle cx={H} cy={H} r={S * 0.05} stroke="currentColor" strokeWidth="0.5" fill="none" />
          <circle cx={H} cy={H} r={S * 0.38} stroke="currentColor" strokeWidth="0.25" fill="none" strokeDasharray="3 5" />
          <line x1={0} y1={0} x2={H - r1 * 0.7} y2={H - r1 * 0.7} stroke="currentColor" strokeWidth="0.25" />
          <line x1={S} y1={0} x2={H + r1 * 0.7} y2={H - r1 * 0.7} stroke="currentColor" strokeWidth="0.25" />
          <line x1={0} y1={S} x2={H - r1 * 0.7} y2={H + r1 * 0.7} stroke="currentColor" strokeWidth="0.25" />
          <line x1={S} y1={S} x2={H + r1 * 0.7} y2={H + r1 * 0.7} stroke="currentColor" strokeWidth="0.25" />
          <line x1={H} y1={0} x2={H} y2={H - r1} stroke="currentColor" strokeWidth="0.3" />
          <line x1={H} y1={S} x2={H} y2={H + r1} stroke="currentColor" strokeWidth="0.3" />
          <line x1={0} y1={H} x2={H - r1} y2={H} stroke="currentColor" strokeWidth="0.3" />
          <line x1={S} y1={H} x2={H + r1} y2={H} stroke="currentColor" strokeWidth="0.3" />
        </pattern>
        <radialGradient id="geo-fade" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="geo-mask">
          <rect width="960" height="960" fill="url(#geo-fade)" />
        </mask>
      </defs>
      <rect width="960" height="960" fill="url(#islamic-geo)" className="text-primary" mask="url(#geo-mask)" />
    </svg>
  );
}
