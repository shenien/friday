import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { describeWeatherCode, type WeatherKind } from "../lib/weatherCodes";
import { WeatherIcon } from "./WeatherIcon";

interface DayForecast {
  date: string;
  label: string;
  kind: WeatherKind;
  high: number;
  low: number;
}

interface WeatherState {
  status: "loading" | "error" | "ready";
  tempF?: number;
  label?: string;
  kind?: WeatherKind;
  city?: string;
  todayHigh?: number;
  todayLow?: number;
  daily?: DayForecast[];
}

interface StoredLocation {
  latitude: number;
  longitude: number;
  label: string;
}

const STORAGE_KEY = "friday.location";
const dayFormatter = new Intl.DateTimeFormat(undefined, { weekday: "short" });

function loadStoredLocation(): StoredLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveStoredLocation(location: StoredLocation | null) {
  try {
    if (location) localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable — override just won't persist across reloads.
  }
}

async function fetchWeather(latitude: number, longitude: number) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("current", "temperature_2m,weather_code");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,weather_code");
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather request failed");
  return res.json();
}

async function locateByIp() {
  const res = await fetch("https://ipapi.co/json/");
  if (!res.ok) throw new Error("IP lookup failed");
  const data = await res.json();
  return { latitude: data.latitude, longitude: data.longitude, city: data.city as string | undefined };
}

async function geocode(query: string): Promise<StoredLocation | null> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "1");
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const match = data.results?.[0];
  if (!match) return null;
  const label = [match.name, match.admin1, match.country_code].filter(Boolean).join(", ");
  return { latitude: match.latitude, longitude: match.longitude, label };
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherState>({ status: "loading" });
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [override, setOverride] = useState<StoredLocation | null>(() => loadStoredLocation());
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFor(latitude: number, longitude: number, city?: string) {
      const data = await fetchWeather(latitude, longitude);
      if (cancelled) return;
      const { label, kind } = describeWeatherCode(data.current.weather_code);
      const daily: DayForecast[] = data.daily.time.map((date: string, i: number) => ({
        date,
        label: i === 0 ? "Today" : dayFormatter.format(new Date(date)),
        kind: describeWeatherCode(data.daily.weather_code[i]).kind,
        high: Math.round(data.daily.temperature_2m_max[i]),
        low: Math.round(data.daily.temperature_2m_min[i]),
      }));
      setWeather({
        status: "ready",
        tempF: Math.round(data.current.temperature_2m),
        label,
        kind,
        city,
        todayHigh: daily[0]?.high,
        todayLow: daily[0]?.low,
        daily,
      });
    }

    if (override) {
      loadFor(override.latitude, override.longitude, override.label).catch(
        () => !cancelled && setWeather({ status: "error" }),
      );
      return () => {
        cancelled = true;
      };
    }

    function useIpFallback() {
      locateByIp()
        .then(({ latitude, longitude, city }) => loadFor(latitude, longitude, city))
        .catch(() => !cancelled && setWeather({ status: "error" }));
    }

    if (!("geolocation" in navigator)) {
      useIpFallback();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        loadFor(position.coords.latitude, position.coords.longitude).catch(useIpFallback);
      },
      useIpFallback,
      { timeout: 8000 },
    );

    return () => {
      cancelled = true;
    };
  }, [override]);

  async function submitLocation() {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearching(true);
    setSearchError(null);
    const result = await geocode(trimmed);
    setSearching(false);
    if (!result) {
      setSearchError("Couldn't find that place.");
      return;
    }
    saveStoredLocation(result);
    setOverride(result);
    setWeather({ status: "loading" });
    setEditing(false);
    setQuery("");
  }

  function resetToAuto() {
    saveStoredLocation(null);
    setOverride(null);
    setWeather({ status: "loading" });
  }

  const weekLows = weather.daily?.map((d) => d.low) ?? [];
  const weekHighs = weather.daily?.map((d) => d.high) ?? [];
  const weekMin = Math.min(...weekLows);
  const weekMax = Math.max(...weekHighs);
  const weekRange = weekMax - weekMin || 1;

  return (
    <div id="weather" className="glass flex flex-col gap-3 rounded-2xl px-5 py-4">
      <div className="flex items-center gap-4">
        {weather.status === "ready" && weather.kind && (
          <>
            <WeatherIcon kind={weather.kind} size={52} />
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-semibold text-ink">{weather.tempF}°</p>
                {weather.todayHigh !== undefined && (
                  <span className="text-xs text-ink-faint">
                    H:{weather.todayHigh}° L:{weather.todayLow}°
                  </span>
                )}
              </div>
              <p className="text-sm text-ink-dim">
                {weather.label}
                {weather.city ? ` · ${weather.city}` : ""}
              </p>
            </div>
          </>
        )}
        {weather.status === "loading" && (
          <p className="flex-1 text-sm text-ink-faint">Reading the skies…</p>
        )}
        {weather.status === "error" && (
          <p className="flex-1 text-sm text-ink-faint">Couldn't reach the weather service.</p>
        )}
        <button
          onClick={() => setEditing((v) => !v)}
          className="shrink-0 text-xs text-ink-faint transition hover:text-cyan"
        >
          {override ? "Change" : "Not here?"}
        </button>
      </div>

      {editing && (
        <div className="flex items-center gap-2 border-t border-white/10 pt-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitLocation()}
            placeholder="City, e.g. Venice"
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-cyan/50 focus:outline-none"
          />
          <button
            onClick={submitLocation}
            disabled={searching}
            className="shrink-0 rounded-lg bg-gold/90 px-3 py-1.5 text-sm font-medium text-black hover:bg-gold disabled:opacity-50"
          >
            Set
          </button>
          {override && (
            <button onClick={resetToAuto} className="shrink-0 text-xs text-ink-faint hover:text-ink">
              Use auto
            </button>
          )}
        </div>
      )}
      {searchError && <p className="text-xs text-red-400">{searchError}</p>}

      {weather.status === "ready" && weather.daily && (
        <div className="space-y-1.5 border-t border-white/10 pt-3">
          {weather.daily.map((day, i) => {
            const leftPct = ((day.low - weekMin) / weekRange) * 100;
            const widthPct = Math.max(((day.high - day.low) / weekRange) * 100, 6);
            return (
              <motion.div
                key={day.date}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="grid grid-cols-[2.2rem_1.6rem_1.6rem_1fr_1.6rem] items-center gap-2"
              >
                <span className="text-[11px] text-ink-faint">{day.label}</span>
                <WeatherIcon kind={day.kind} size={20} />
                <span className="text-right text-[11px] text-ink-faint">{day.low}°</span>
                <span className="relative h-1.5 rounded-full bg-white/10">
                  <span
                    className="absolute inset-y-0 rounded-full bg-gradient-to-r from-cyan to-gold"
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  />
                </span>
                <span className="text-right text-[11px] text-ink">{day.high}°</span>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
