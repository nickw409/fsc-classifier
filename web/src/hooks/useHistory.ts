import { useEffect, useState } from "react";
import type { ClassifyResponse } from "../types";

export type HistoryEntry = {
  id: string;
  companyName: string;
  url: string;
  ts: number;
  topCode: string;
  count: number;
  response: ClassifyResponse;
};

const KEY = "fsc.history.v1";
const MAX = 50;

export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? "[]");
    } catch {
      return [];
    }
  });
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(entries));
  }, [entries]);
  return {
    entries,
    selected,
    add: (e: HistoryEntry) =>
      setEntries((prev) => [e, ...prev.filter((p) => p.id !== e.id)].slice(0, MAX)),
    select: setSelected,
    remove: (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id)),
    clear: () => {
      setEntries([]);
      setSelected(null);
    },
  };
}
