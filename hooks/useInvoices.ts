"use client";

import { useEffect, useState } from "react";
import { listenFactures } from "@/lib/facturationService";
import type { Facture } from "@/types";

export const useInvoices = (userId: string) => {
  const [invoices, setInvoices] = useState<Facture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const unsub = listenFactures(userId, (data) => {
      setInvoices(data);
      setLoading(false);
    });

    return () => unsub();
  }, [userId]);

  return { invoices, loading };
};
