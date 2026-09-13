import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface Status {
  configured: boolean;
  connected: boolean;
  email?: string;
}

export function GoogleConnect() {
  const [status, setStatus] = useState<Status | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.googleStatus().then(setStatus);
  }, []);

  if (!status || !status.configured) return null;

  const dotColor = status.connected ? "bg-cyan" : "bg-gold";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-ink-faint transition hover:text-ink"
        title={status.connected ? `Connected to ${status.email}` : "Gmail & Calendar not connected"}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
        Google
      </button>

      {open && (
        <div className="glass absolute right-0 top-6 z-30 w-56 rounded-xl p-3 text-xs">
          {status.connected ? (
            <>
              <p className="mb-2 text-ink-dim">Connected to {status.email}</p>
              <button
                onClick={() => api.googleDisconnect().then(() => setStatus((s) => s && { ...s, connected: false }))}
                className="text-red-400 hover:underline"
              >
                Disconnect
              </button>
            </>
          ) : (
            <a href="/api/auth/google" className="text-cyan hover:underline">
              Connect Google →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
