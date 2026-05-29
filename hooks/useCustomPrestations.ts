"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getUserPrestationSettings,
  saveUserPrestationSettings,
} from "@/lib/userSettingsService";

const LS_LABELS = "tc_prestations_custom";
const LS_PRICES = "tc_prestations_prices";

function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; }
  catch { return fallback; }
}

export function useCustomPrestations(baseLabels: string[], userId?: string) {
  const [custom, setCustom] = useState<string[]>(() => lsGet(LS_LABELS, []));
  const [priceMap, setPriceMap] = useState<Record<string, number>>(
    () => lsGet(LS_PRICES, {})
  );
  // Avoid saving back to Firestore during initial load
  const initialLoad = useRef(true);

  // Load from Firestore once userId is available
  useEffect(() => {
    if (!userId) return;
    getUserPrestationSettings(userId)
      .then((settings) => {
        if (settings.customLabels.length > 0) {
          setCustom(settings.customLabels);
          localStorage.setItem(LS_LABELS, JSON.stringify(settings.customLabels));
        }
        if (Object.keys(settings.priceMap).length > 0) {
          setPriceMap(settings.priceMap);
          localStorage.setItem(LS_PRICES, JSON.stringify(settings.priceMap));
        }
      })
      .catch(() => { /* règle Firestore pas encore déployée — on reste sur localStorage */ })
      .finally(() => { initialLoad.current = false; });
  }, [userId]);

  const allLabels = useMemo(
    () => [...baseLabels, ...custom.filter((l) => !baseLabels.includes(l))]
      .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" })),
    [baseLabels, custom]
  );

  const sync = (labels: string[], prices: Record<string, number>) => {
    if (!userId || initialLoad.current) return;
    saveUserPrestationSettings(userId, { customLabels: labels, priceMap: prices })
      .catch(() => { /* silencieux si règle pas encore déployée */ });
  };

  const addCustomLabel = (label: string) => {
    const trimmed = label.trim();
    if (!trimmed || baseLabels.includes(trimmed) || custom.includes(trimmed)) return;
    const updated = [...custom, trimmed];
    setCustom(updated);
    localStorage.setItem(LS_LABELS, JSON.stringify(updated));
    sync(updated, priceMap);
  };

  const removeCustomLabel = (label: string) => {
    const updated = custom.filter((l) => l !== label);
    setCustom(updated);
    localStorage.setItem(LS_LABELS, JSON.stringify(updated));
    sync(updated, priceMap);
  };

  const savePriceForLabel = (label: string, price: number) => {
    if (!label.trim()) return;
    const updated = { ...priceMap, [label.trim()]: price };
    setPriceMap(updated);
    localStorage.setItem(LS_PRICES, JSON.stringify(updated));
    sync(custom, updated);
  };

  const removePriceForLabel = (label: string) => {
    const updated = { ...priceMap };
    delete updated[label.trim()];
    setPriceMap(updated);
    localStorage.setItem(LS_PRICES, JSON.stringify(updated));
    sync(custom, updated);
  };

  return {
    allLabels,
    customLabels: custom,
    addCustomLabel,
    removeCustomLabel,
    priceMap,
    savePriceForLabel,
    removePriceForLabel,
  };
}
