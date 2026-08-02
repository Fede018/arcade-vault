import { createClient } from "@/lib/supabase/server";
import type { GameWithStats } from "@/lib/data";
import HomeClient from "@/components/home/home-client";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("games_with_stats")
    .select("*")
    .order("id")
    .limit(6);

  return <HomeClient games={(data as GameWithStats[]) ?? []} />;
}
