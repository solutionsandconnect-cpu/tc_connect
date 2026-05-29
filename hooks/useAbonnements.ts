"use client";

import { useEffect, useState } from "react";
import { listenAbonnementsForClient } from "@/lib/abonnementService";
import type { Abonnement } from "@/types";

export function useAbonnements(clientId?: string) {
  const [abonnements, setAbonnements] = useState<Abonnement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) {
      setAbonnements([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = listenAbonnementsForClient(clientId, (data) => {
      setAbonnements(data);
      setLoading(false);
    });
    return unsub;
  }, [clientId]);

  return { abonnements, loading };
}
