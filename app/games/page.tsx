import { createClient } from "@/lib/supabase/server";
import type { GameWithStats } from "@/lib/data";
import LibraryClient from "@/components/games/library-client";

export default async function GamesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("games_with_stats")
    .select("*")
    .order("id");

  return <LibraryClient games={(data as GameWithStats[]) ?? []} />;
}
