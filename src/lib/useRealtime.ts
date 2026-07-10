"use client";

import { useEffect, useRef } from "react";
import { supabase } from "./supabase";

/**
 * Calls `onChange` whenever a row in any of `tables` changes
 * (insert / update / delete) via Supabase Realtime.
 * Pair it with a `useCallback` refetch of the data you care about.
 */
export function useDataChanged(tables: string[], onChange: () => void) {
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  const key = tables.join(",");

  useEffect(() => {
    const channel = supabase
      .channel(`data-${key}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public" },
        (payload) => {
          const table = (payload as { table?: string }).table;
          if (table && tables.includes(table)) cbRef.current();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
