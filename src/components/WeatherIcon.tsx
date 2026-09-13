import { useId } from "react";
import type { WeatherKind } from "../lib/weatherCodes";

function Cloud({ fill, cx = 32, cy = 36, scale = 1 }: { fill: string; cx?: number; cy?: number; scale?: number }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${scale})`} fill={fill}>
      <ellipse cx="-6" cy="4" rx="16" ry="11" />
      <circle cx="-14" cy="-6" r="10" />
      <circle cx="2" cy="-10" r="12" />
      <circle cx="15" cy="-3" r="9" />
      <rect x="-22" y="-3" width="46" height="15" rx="7.5" />
    </g>
  );
}

export function WeatherIcon({ kind, size = 40 }: { kind: WeatherKind; size?: number }) {
  const id = useId();
  const sunGrad = `sun-${id}`;
  const cloudGrad = `cloud-${id}`;
  const cloudGradDark = `cloudDark-${id}`;
  const glow = `glow-${id}`;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={sunGrad} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#fff6d6" />
          <stop offset="45%" stopColor="#ffcf5c" />
          <stop offset="100%" stopColor="#ff9d2e" />
        </radialGradient>
        <linearGradient id={cloudGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fdfdff" />
          <stop offset="100%" stopColor="#c9ced9" />
        </linearGradient>
        <linearGradient id={cloudGradDark} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#aab1c2" />
          <stop offset="100%" stopColor="#727a8c" />
        </linearGradient>
        <filter id={glow} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4.5" />
        </filter>
      </defs>

      {kind === "clear" && (
        <>
          <circle cx="32" cy="30" r="17" fill={`url(#${sunGrad})`} opacity="0.5" filter={`url(#${glow})`} />
          <circle cx="32" cy="30" r="14" fill={`url(#${sunGrad})`} />
        </>
      )}

      {kind === "partly-cloudy" && (
        <>
          <circle cx="24" cy="22" r="12" fill={`url(#${sunGrad})`} opacity="0.45" filter={`url(#${glow})`} />
          <circle cx="24" cy="22" r="10" fill={`url(#${sunGrad})`} />
          <Cloud fill={`url(#${cloudGrad})`} cx={36} cy={38} scale={0.95} />
        </>
      )}

      {kind === "cloudy" && (
        <>
          <Cloud fill={`url(#${cloudGradDark})`} cx={30} cy={30} scale={0.85} />
          <Cloud fill={`url(#${cloudGrad})`} cx={34} cy={40} scale={1} />
        </>
      )}

      {kind === "fog" && (
        <>
          <Cloud fill={`url(#${cloudGrad})`} cx={32} cy={30} scale={0.9} />
          {[40, 48, 56].map((y) => (
            <path
              key={y}
              d={`M14 ${y} q6 -5 12 0 t12 0 t12 0`}
              stroke="#c9ced9"
              strokeWidth="2.4"
              strokeLinecap="round"
              fill="none"
              opacity="0.8"
            />
          ))}
        </>
      )}

      {(kind === "drizzle" || kind === "rain") && (
        <>
          <Cloud fill={`url(#${cloudGradDark})`} cx={32} cy={28} scale={0.95} />
          {(kind === "rain" ? [16, 26, 36, 46] : [20, 32, 44]).map((x, i) => (
            <line
              key={x}
              x1={x}
              y1={kind === "rain" ? 46 : 47}
              x2={x - 5}
              y2={kind === "rain" ? 58 : 54}
              stroke="#5fc6f0"
              strokeWidth={kind === "rain" ? 2.6 : 2.2}
              strokeLinecap="round"
              opacity={0.55 + i * 0.1}
            />
          ))}
        </>
      )}

      {kind === "snow" && (
        <>
          <Cloud fill={`url(#${cloudGrad})`} cx={32} cy={28} scale={0.95} />
          {[[20, 50], [32, 56], [44, 50]].map(([x, y]) => (
            <g key={x} stroke="#eaf2ff" strokeWidth="2" strokeLinecap="round">
              <line x1={x - 4} y1={y} x2={x + 4} y2={y} />
              <line x1={x} y1={y - 4} x2={x} y2={y + 4} />
              <line x1={x - 3} y1={y - 3} x2={x + 3} y2={y + 3} />
              <line x1={x - 3} y1={y + 3} x2={x + 3} y2={y - 3} />
            </g>
          ))}
        </>
      )}

      {kind === "thunderstorm" && (
        <>
          <Cloud fill={`url(#${cloudGradDark})`} cx={32} cy={26} scale={0.95} />
          <polygon points="30,42 22,54 29,54 26,64 38,48 31,48 34,42" fill="#ffd54a" />
          <line x1="16" y1="48" x2="12" y2="56" stroke="#5fc6f0" strokeWidth="2.2" strokeLinecap="round" opacity="0.6" />
          <line x1="48" y1="48" x2="44" y2="56" stroke="#5fc6f0" strokeWidth="2.2" strokeLinecap="round" opacity="0.6" />
        </>
      )}
    </svg>
  );
}
