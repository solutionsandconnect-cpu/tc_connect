"use client";
import { useEffect, useState } from "react";
import { listenStoreApps } from "@/lib/storeService";
import { useAuth } from "@/context/AuthContext";
import type { StoreApp } from "@/types";

export function useStoreApps() {
  const { currentUser } = useAuth();
  const [apps, setApps] = useState<StoreApp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) { setLoading(false); return; }
    const unsub = listenStoreApps((data) => {
      setApps(data);
      setLoading(false);
    });
    return unsub;
  }, [currentUser]);

  return { apps, loading };
}
