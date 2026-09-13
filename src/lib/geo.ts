export interface GeoLocation {
  latitude: number;
  longitude: number;
  label: string;
}

export async function geocodeLocation(query: string): Promise<GeoLocation | null> {
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

export async function fetchDailyForecast(latitude: number, longitude: number, days = 16) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,weather_code");
  url.searchParams.set("forecast_days", String(Math.min(days, 16)));
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather request failed");
  const data = await res.json();
  return data.daily as {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
  };
}
