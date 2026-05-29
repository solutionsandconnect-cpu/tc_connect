"use client";

import { useEffect, useState } from "react";
import { listenUrssafPeriodes } from "@/lib/urssafService";
import type { UrssafPeriode } from "@/types";

export const useUrssafPeriodes = (userId: string) => {
  const [periodes, setPeriodes] = useState<UrssafPeriode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const unsub = listenUrssafPeriodes(userId, (data) => {
      setPeriodes(data);
      setLoading(false);
    });
    return () => unsub();
  }, [userId]);

  return { periodes, loading };
};
