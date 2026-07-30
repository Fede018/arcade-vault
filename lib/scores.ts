export interface ScoreEntry {
  game: string;
  score: number;
  name: string;
  at: number;
}

export function saveScore(entry: Omit<ScoreEntry, "at">) {
  try {
    const all: ScoreEntry[] = JSON.parse(localStorage.getItem("av_scores") || "[]");
    all.push({ ...entry, at: Date.now() });
    localStorage.setItem("av_scores", JSON.stringify(all));
  } catch {
    // localStorage unavailable — ignore
  }
}
