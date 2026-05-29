"use client";

import { useEffect, useState } from "react";
import { listenCompanies } from "@/lib/companyService";
import { useAuth } from "@/context/AuthContext";
import type { Company } from "@/types";

export function useCompanies() {
  const { currentUser } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = listenCompanies(currentUser.uid, (data) => {
      setCompanies(data);
      setLoading(false);
    });
    return unsub;
  }, [currentUser?.uid]);

  return { companies, loading };
}
