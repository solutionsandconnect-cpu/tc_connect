"use client";
import { useEffect, useState } from "react";
import { listenStoreSubscriptions, listenMyStoreSubscriptions } from "@/lib/storeService";
import { useAuth } from "@/context/AuthContext";
import type { StoreSubscription } from "@/types";

export function useStoreSubscriptions() {
  const { currentUser } = useAuth();
  const [subscriptions, setSubscriptions] = useState<StoreSubscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) { setLoading(false); return; }
    const unsub = listenStoreSubscriptions((data) => {
      setSubscriptions(data);
      setLoading(false);
    });
    return unsub;
  }, [currentUser]);

  return { subscriptions, loading };
}

export function useMyStoreSubscriptions(userUid: string | undefined) {
  const [subscriptions, setSubscriptions] = useState<StoreSubscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userUid) { setLoading(false); return; }
    const unsub = listenMyStoreSubscriptions(userUid, (data) => {
      setSubscriptions(data);
      setLoading(false);
    });
    return unsub;
  }, [userUid]);

  return { subscriptions, loading };
}
