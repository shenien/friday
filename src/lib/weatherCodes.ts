export type WeatherKind =
  | "clear"
  | "partly-cloudy"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "thunderstorm";

// WMO weather interpretation codes, as used by Open-Meteo.
const WEATHER_CODES: Record<number, { label: string; kind: WeatherKind }> = {
  0: { label: "Clear sky", kind: "clear" },
  1: { label: "Mostly clear", kind: "clear" },
  2: { label: "Partly cloudy", kind: "partly-cloudy" },
  3: { label: "Overcast", kind: "cloudy" },
  45: { label: "Fog", kind: "fog" },
  48: { label: "Depositing rime fog", kind: "fog" },
  51: { label: "Light drizzle", kind: "drizzle" },
  53: { label: "Drizzle", kind: "drizzle" },
  55: { label: "Dense drizzle", kind: "drizzle" },
  61: { label: "Light rain", kind: "rain" },
  63: { label: "Rain", kind: "rain" },
  65: { label: "Heavy rain", kind: "rain" },
  71: { label: "Light snow", kind: "snow" },
  73: { label: "Snow", kind: "snow" },
  75: { label: "Heavy snow", kind: "snow" },
  80: { label: "Rain showers", kind: "rain" },
  81: { label: "Rain showers", kind: "rain" },
  82: { label: "Violent rain showers", kind: "rain" },
  95: { label: "Thunderstorm", kind: "thunderstorm" },
  96: { label: "Thunderstorm with hail", kind: "thunderstorm" },
  99: { label: "Thunderstorm with hail", kind: "thunderstorm" },
};

export function describeWeatherCode(code: number) {
  return WEATHER_CODES[code] ?? { label: "Unknown", kind: "cloudy" as WeatherKind };
}
