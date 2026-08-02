import { createClient } from "@/lib/supabase/client";

export interface ScoreEntry {
  game: string;
  score: number;
  name: string;
}

export async function saveScore(entry: ScoreEntry) {
  const supabase = createClient();
  await supabase
    .from("scores")
    .insert({ game_id: entry.game, score: entry.score, name: entry.name });
}

const PLAYER_NAME_KEY = "av_player_name";

export function getSavedPlayerName(): string | null {
  try {
    return localStorage.getItem(PLAYER_NAME_KEY);
  } catch {
    return null;
  }
}

export function setSavedPlayerName(name: string) {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, name);
  } catch {
    // localStorage unavailable — ignore
  }
}
