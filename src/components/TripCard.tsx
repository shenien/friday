import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, type PackingList } from "../lib/api";
import { describeWeatherCode } from "../lib/weatherCodes";
import { geocodeLocation, fetchDailyForecast } from "../lib/geo";
import { parseLocalDate } from "../lib/date";
import { WeatherIcon } from "./WeatherIcon";
import type { CalendarEvent } from "../types";

const DAY_MS = 86400000;
const dateFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

interface TripForecastDay {
  date: string;
  high: number;
  low: number;
  kind: ReturnType<typeof describeWeatherCode>["kind"];
}

function findNextTrip(events: CalendarEvent[]): { event: CalendarEvent; start: Date; inclusiveEnd: Date } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const trips = events
    .filter((e) => e.allDay && e.start && e.end)
    .map((e) => {
      const start = parseLocalDate(e.start!);
      const inclusiveEnd = new Date(parseLocalDate(e.end!).getTime() - DAY_MS);
      return { event: e, start, inclusiveEnd };
    })
    .filter((t) => t.inclusiveEnd.getTime() > t.start.getTime() && t.inclusiveEnd.getTime() >= today.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  return trips[0] || null;
}

export function TripCard() {
  const [trip, setTrip] = useState<ReturnType<typeof findNextTrip>>(null);
  const [forecast, setForecast] = useState<TripForecastDay[] | "unavailable" | null>(null);
  const [packing, setPacking] = useState<PackingList | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    api
      .agenda()
      .then(({ events }) => setTrip(findNextTrip(events)))
      .catch(() => setTrip(null));
  }, []);

  useEffect(() => {
    if (!trip) return;
    api.getPackingList(trip.event.id).then(({ list }) => setPacking(list));

    if (!trip.event.location) {
      setForecast("unavailable");
      return;
    }
    geocodeLocation(trip.event.location)
      .then((loc) => {
        if (!loc) return setForecast("unavailable");
        return fetchDailyForecast(loc.latitude, loc.longitude).then((daily) => {
          const days: TripForecastDay[] = daily.time
            .map((date, i) => ({
              date,
              high: Math.round(daily.temperature_2m_max[i]),
              low: Math.round(daily.temperature_2m_min[i]),
              kind: describeWeatherCode(daily.weather_code[i]).kind,
            }))
            .filter((d) => {
              const dTime = parseLocalDate(d.date).getTime();
              return dTime >= trip.start.getTime() && dTime <= trip.inclusiveEnd.getTime();
            });
          setForecast(days.length > 0 ? days : "unavailable");
        });
      })
      .catch(() => setForecast("unavailable"));
  }, [trip]);

  async function generatePacking() {
    if (!trip) return;
    setGenerating(true);
    const nights = Math.round((trip.inclusiveEnd.getTime() - trip.start.getTime()) / DAY_MS);
    const weatherSummary =
      Array.isArray(forecast) && forecast.length > 0
        ? `Highs around ${Math.max(...forecast.map((f) => f.high))}°F, lows around ${Math.min(...forecast.map((f) => f.low))}°F`
        : undefined;
    try {
      const { list } = await api.generatePackingList(trip.event.id, {
        title: trip.event.title,
        nights,
        location: trip.event.location,
        weatherSummary,
      });
      setPacking(list);
    } finally {
      setGenerating(false);
    }
  }

  async function toggleItem(index: number, checked: boolean) {
    if (!trip) return;
    const { list } = await api.toggleItem(trip.event.id, index, checked);
    setPacking(list);
  }

  if (!trip) return null;

  const daysUntil = Math.round((trip.start.getTime() - new Date().setHours(0, 0, 0, 0)) / DAY_MS);
  const countdown = daysUntil <= 0 ? "Underway" : daysUntil === 1 ? "Tomorrow" : `in ${daysUntil} days`;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Next Trip</h2>
          <p className="mt-1 text-lg font-semibold text-ink">{trip.event.title}</p>
          <p className="text-sm text-ink-faint">
            {dateFormatter.format(trip.start)} – {dateFormatter.format(trip.inclusiveEnd)}
            {trip.event.location ? ` · ${trip.event.location}` : ""}
          </p>
        </div>
        <span className="rounded-full bg-cyan/15 px-3 py-1 text-sm font-medium text-cyan">{countdown}</span>
      </div>

      {Array.isArray(forecast) && (
        <div className="mt-4 flex gap-3 overflow-x-auto border-t border-white/10 pt-3">
          {forecast.map((day) => (
            <div key={day.date} className="flex shrink-0 flex-col items-center gap-1">
              <span className="text-[11px] text-ink-faint">{dateFormatter.format(parseLocalDate(day.date))}</span>
              <WeatherIcon kind={day.kind} size={24} />
              <span className="text-[11px] text-ink">
                {day.high}°/{day.low}°
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 border-t border-white/10 pt-3">
        {!packing && (
          <button
            onClick={generatePacking}
            disabled={generating}
            className="rounded-lg bg-gold/90 px-3 py-1.5 text-sm font-medium text-black transition hover:bg-gold disabled:opacity-50"
          >
            {generating ? "Packing your bags…" : "Generate packing list"}
          </button>
        )}
        {packing && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            {packing.items.map((item, i) => (
              <label key={i} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={(e) => toggleItem(i, e.target.checked)}
                  className="accent-cyan"
                />
                <span className={item.checked ? "text-ink-faint line-through" : "text-ink-dim"}>
                  {item.text}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
