import { useEffect, useState } from "react";
import { GoogleConnect } from "./GoogleConnect";

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

export function StatusStrip() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-medium uppercase tracking-widest text-ink-faint">
      <span>{dateFormatter.format(now)}</span>
      <span className="flex items-center gap-2">
        <span className="breathe h-1.5 w-1.5 rounded-full bg-cyan" />
        Systems nominal
      </span>
      <div className="flex items-center gap-4">
        <span className="font-mono normal-case tracking-normal text-ink-dim">
          {timeFormatter.format(now)}
        </span>
        <GoogleConnect />
      </div>
    </div>
  );
}
