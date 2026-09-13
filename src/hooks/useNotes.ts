import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Note } from "../types";

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    return api.listNotes().then(({ notes }) => setNotes(notes));
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  async function addNote(text: string) {
    const { note } = await api.addNote(text);
    setNotes((prev) => [note, ...prev]);
  }

  async function removeNote(id: string) {
    await api.deleteNote(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  return { notes, loading, refresh, addNote, removeNote };
}
