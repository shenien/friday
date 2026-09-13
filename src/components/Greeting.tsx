import { useState } from "react";
import { pickGreeting } from "../lib/greeting";

export function Greeting() {
  const [line] = useState(() => pickGreeting());

  return (
    <div className="flex items-center gap-4">
      <span className="breathe h-3 w-3 rounded-full bg-cyan" />
      <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{line.text}</h1>
    </div>
  );
}
