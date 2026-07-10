import { getSupabase } from "./supabase-client.js";
import { debounce } from "./ui.js";

let serial = 0;

export function subscribeToChanges(tables, callback) {
  const client = getSupabase();
  const run = debounce(callback, 180);
  let channel = client.channel(`biggame-${Date.now()}-${serial++}`);

  for (const table of tables) {
    channel = channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      run,
    );
  }
  channel.subscribe();
  return () => client.removeChannel(channel);
}
