import { useEffect, useState } from "react";
import { normalizeMatchData } from "./normalize";
import type { MatchData } from "./types";

export function useMatchAnalysisData() {
  const [data, setData] = useState<MatchData | null | undefined>(undefined);

  useEffect(() => {
    window.ferroAPI.getLastMatch().then((matchData) => setData(normalizeMatchData(matchData)));
  }, []);

  return data;
}
