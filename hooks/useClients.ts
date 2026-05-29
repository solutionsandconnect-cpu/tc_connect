"use client";

import { useEffect, useState } from "react";
import { listenClients } from "@/lib/clientService";
import { useAuth } from "@/context/AuthContext";
import type { Client } from "@/types";

export function useClients() {
  const { currentUser } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = listenClients(currentUser.uid, (data) => {
      setClients(data);
      setLoading(false);
    });
    return unsub;
  }, [currentUser?.uid]);

  return { clients, loading };
}
