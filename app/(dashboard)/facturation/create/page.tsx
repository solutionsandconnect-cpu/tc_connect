"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCustomPrestations } from "@/hooks/useCustomPrestations";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useClients } from "@/hooks/useClients";
import { useAbonnements } from "@/hooks/useAbonnements";
import { useCompanies } from "@/hooks/useCompanies";
import { createFacture } from "@/lib/facturationService";
import { createAbonnement } from "@/lib/abonnementService";
import ClientEditModal from "@/components/ui/ClientEditModal";
import { AbonnementModal } from "@/components/ui/AbonnementModal";
import { itemNetTotal } from "@/lib/invoicePdf";
import { Timestamp } from "firebase/firestore";
import type { FactureItem, FactureType, Echeance, Client, Abonnement } from "@/types";

function fmtMoney(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2 });
}

const ECHEANCE_LABELS = [
  "Acompte 30 %", "Acompte 40 %", "Acompte 50 %",
  "Acompte 60 %", "Acompte 70 %", "Acompte 100 %",
  "Solde", "Paiement comptant",
  "1ère mensualité", "2ème mensualité", "3ème mensualité", "4ème mensualité", "5ème mensualité", "6ème mensualité", "7ème mensualité", "8ème mensualité", "9ème mensualité", "10ème mensualité",
];

const PRESTATIONS_LABELS = [
  "Séance coaching individuel",
  "Séance coaching en groupe",
  "Bilan initial",
  "Bilan de mi-parcours",
  "Bilan final",
  "Programme personnalisé",
  "Suivi mensuel",
  "Abonnement mensuel",
  "Forfait 5 séances",
  "Forfait 10 séances",
  "Forfait 20 séances",
  "Préparation physique",
  "Récupération",
];

function SuggestDropdown({ value, onChange, options, placeholder, wrapperClassName, inputClassName, onCommit, removableLabels, onRemoveOption }: {
  value: string; onChange: (v: string) => void; options: string[];
  placeholder?: string; wrapperClassName?: string; inputClassName?: string;
  onCommit?: (v: string) => void;
  removableLabels?: string[]; onRemoveOption?: (label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filtered = value.trim()
    ? options.filter((s) => s.toLowerCase().includes(value.toLowerCase()))
    : options;

  useEffect(() => {
    const handler = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  return (
    <div ref={ref} className={`relative ${wrapperClassName ?? ""}`}>
      <input type="text" value={value} placeholder={placeholder}
        className={inputClassName}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={(e) => { setOpen(false); onCommit?.(e.target.value); }}
        onKeyDown={(e) => { if (e.key === "Enter") { setOpen(false); onCommit?.((e.target as HTMLInputElement).value); } }}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-44 overflow-y-auto">
          {filtered.map((s) => {
            const isRemovable = removableLabels?.includes(s);
            return (
              <div key={s} className="flex items-center border-b border-gray-50 last:border-0">
                <button type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={() => { onChange(s); setOpen(false); }}
                  className="flex-1 text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 transition">
                  {s}
                </button>
                {isRemovable && onRemoveOption && (
                  <button type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={() => onRemoveOption(s)}
                    className="px-2 py-2 text-gray-300 hover:text-red-500 transition shrink-0" title="Supprimer de la liste">
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EcheanceLabelInput({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return <SuggestDropdown value={value} onChange={onChange} options={ECHEANCE_LABELS} placeholder={placeholder} inputClassName={className} />;
}

export default function CreateFacturePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser } = useAuth();
  const { clients, loading: loadingClients } = useClients();
  const { companies } = useCompanies();

  const [docType, setDocType] = useState<FactureType>(() =>
    searchParams.get("type") === "devis" ? "devis" : "facture"
  );
  const [documentDate, setDocumentDate] = useState(() => new Date().toISOString().split("T")[0]);

  // ── Étape 1 : client ──────────────────────────────────────
  const [clientSearch, setClientSearch] = useState("");
  const [clientFocused, setClientFocused] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Quick-add client
  const [showClientModal, setShowClientModal] = useState(false);
  const [pendingAutoSelect, setPendingAutoSelect] = useState(false);

  // ── Facturer à (override coordonnées) ────────────────────
  const [factureMode, setFactureMode] = useState<"client" | "contact" | "manual">("client");
  const [selectedContactIdx, setSelectedContactIdx] = useState(0);
  const [manualFactureNom, setManualFactureNom] = useState("");
  const [manualFactureAdresse, setManualFactureAdresse] = useState("");
  const [manualFactureCodePostal, setManualFactureCodePostal] = useState("");
  const [manualFactureVille, setManualFactureVille] = useState("");

  // reset when client changes
  const handleSelectClient = (c: Client) => {
    selectClient(c);
    setFactureMode("client");
    setSelectedContactIdx(0);
    setManualFactureNom(""); setManualFactureAdresse(""); setManualFactureCodePostal(""); setManualFactureVille("");
  };

  // ── Ajout rapide d'abonnement ─────────────────────────────
  const [showAddAbo, setShowAddAbo] = useState(false);
  const [pendingAboId, setPendingAboId] = useState<string | null>(null);

  // ── Étape 2 : abonnement ──────────────────────────────────
  const { abonnements, loading: loadingAbo } = useAbonnements(selectedClient?.id);
  const [selectedAbo, setSelectedAbo] = useState<Abonnement | null>(null);

  // ── Étape 3 : lignes + options ────────────────────────────
  const { allLabels: allPrestations, customLabels, addCustomLabel, removeCustomLabel, priceMap, savePriceForLabel, removePriceForLabel } = useCustomPrestations(PRESTATIONS_LABELS, currentUser?.uid);
  const [items, setItems] = useState<FactureItem[]>([{ label: "", quantity: 1, price: 0 }]);
  const [notes, setNotes] = useState("");
  const [useEcheancier, setUseEcheancier] = useState(false);
  const [autoBalance, setAutoBalance] = useState(true);
  const [copiedMontant, setCopiedMontant] = useState<string | null>(null);
  const [echeances, setEcheances] = useState<{ label: string; date: string; montant: string; manualMontant?: boolean }[]>([
    { label: "1ère mensualité", date: "", montant: "" },
    { label: "2ème mensualité", date: "", montant: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const totalGross = items.reduce((acc, i) => acc + i.quantity * i.price, 0);
  const total = items.reduce((acc, i) => acc + itemNetTotal(i), 0);
  const totalDiscount = totalGross - total;
  const echeanceSum = echeances.reduce((s, e) => s + (Number(e.montant) || 0), 0);

  // Auto-sélection après création rapide d'abonnement
  useEffect(() => {
    if (!pendingAboId || abonnements.length === 0) return;
    const found = abonnements.find((a) => a.id === pendingAboId);
    if (found) { selectAbo(found); setPendingAboId(null); }
  }, [abonnements, pendingAboId]);

  // ── Abonnements triés par catégorie + numérotés ───────────
  const { sortedAbos, aboNumbers } = useMemo(() => {
    const sorted = [...abonnements].sort(
      (a, b) => (a.dateDebut?.toMillis?.() ?? 0) - (b.dateDebut?.toMillis?.() ?? 0)
    );
    const catCounters: Record<string, number> = {};
    const nums: Record<string, number> = {};
    sorted.forEach((a) => {
      catCounters[a.categorie] = (catCounters[a.categorie] ?? 0) + 1;
      nums[a.id] = catCounters[a.categorie];
    });
    return { sortedAbos: sorted, aboNumbers: nums };
  }, [abonnements]);

  // ── Sélection client ──────────────────────────────────────
  const filteredClients = clients.filter((c) => {
    const q = clientSearch.toLowerCase();
    return !q || (c.nom ?? "").toLowerCase().includes(q) || (c.prenom ?? "").toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q);
  });

  const selectClient = (c: Client) => {
    setSelectedClient(c);
    setSelectedAbo(null);
    setClientSearch("");
    setClientFocused(false);
    setItems([{ label: "", quantity: 1, price: 0 }]);
    // Pré-sélectionner les coordonnées de facturation par défaut si définies
    const contacts = (c as any).contactsSupplementaires as import("@/types").ContactSupplementaire[] | undefined ?? [];
    const defaultIdx = contacts.findIndex((ct) => ct.factureParDefaut);
    if (defaultIdx >= 0) {
      setFactureMode("contact");
      setSelectedContactIdx(defaultIdx);
    } else {
      setFactureMode("client");
      setSelectedContactIdx(0);
    }
  };

  // Auto-sélection du client après création via ClientEditModal
  useEffect(() => {
    if (!pendingAutoSelect || clients.length === 0) return;
    const newest = [...clients].sort(
      (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
    )[0];
    if (newest) {
      handleSelectClient(newest);
      setPendingAutoSelect(false);
    }
  }, [clients, pendingAutoSelect]);

  // ── Sélection abonnement ──────────────────────────────────
  const aboDisplayName = (a: Abonnement) =>
    aboNumbers[a.id] ? `${a.categorie} - N°${aboNumbers[a.id]}` : a.categorie;

  const selectAbo = (a: Abonnement) => {
    setSelectedAbo(a);
    if (a.tarifUnitaire && a.tarifUnitaire > 0) {
      setItems([{ label: `${aboDisplayName(a)}${a.tarifLabel ? ` ${a.tarifLabel}` : ""}`, quantity: 1, price: a.tarifUnitaire }]);
    }
    setNotes(a.notes ?? "");
  };

  // ── Items ─────────────────────────────────────────────────
  const addItem = () => setItems((p) => [...p, { label: "", quantity: 1, price: 0 }]);
  const updateItem = (i: number, field: keyof FactureItem, value: string | number) =>
    setItems((p) => p.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));
  const removeItem = (i: number) => { if (items.length > 1) setItems((p) => p.filter((_, idx) => idx !== i)); };
  const duplicateItem = (i: number) => setItems((p) => { const copy = [...p]; copy.splice(i + 1, 0, { ...p[i] }); return copy; });

  // ── Échéancier ────────────────────────────────────────────
  const MENSUALITE_LABELS = [
    "1ère mensualité", "2ème mensualité", "3ème mensualité", "4ème mensualité",
    "5ème mensualité", "6ème mensualité", "7ème mensualité", "8ème mensualité",
    "9ème mensualité", "10ème mensualité",
  ];
  const mensualiteLabel = (n: number) => MENSUALITE_LABELS[n - 1] ?? `${n}ème mensualité`;

  const addOneMonth = (dateStr: string): string => {
    if (!dateStr) return "";
    const [y, m, dayStr] = dateStr.split("-").map(Number);
    const newMonth = m % 12;          // 0-based target month (m is 1-based)
    const newYear = m === 12 ? y + 1 : y;
    const daysInMonth = new Date(newYear, newMonth + 1, 0).getDate(); // last day of target month
    const finalDay = Math.min(dayStr, daysInMonth);
    return `${newYear}-${String(newMonth + 1).padStart(2, "0")}-${String(finalDay).padStart(2, "0")}`;
  };

  const distributeEvenly = (rows: typeof echeances, t: number) => {
    if (rows.length === 0 || t <= 0) return rows;
    const share = Math.floor((t / rows.length) * 100) / 100;
    const last = Math.round((t - share * (rows.length - 1)) * 100) / 100;
    return rows.map((e, idx) => ({ ...e, montant: String(idx === rows.length - 1 ? last : share), manualMontant: false }));
  };

  const toggleEcheancier = () => {
    if (!useEcheancier) {
      setAutoBalance(true);
      const date1 = documentDate || "";
      const date2 = date1 ? addOneMonth(date1) : "";
      const baseRows = [
        { label: "1ère mensualité", date: date1, montant: "" },
        { label: "2ème mensualité", date: date2, montant: "" },
      ];
      setEcheances(total > 0 ? distributeEvenly(baseRows, total) : baseRows);
    }
    setUseEcheancier((v) => !v);
  };
  const addEcheance = () => setEcheances((p) => {
    const n = p.length + 1;
    const lastDate = p[p.length - 1]?.date ?? "";
    const nextDate = lastDate ? addOneMonth(lastDate) : "";
    const next = [...p, { label: mensualiteLabel(n), date: nextDate, montant: "" }];
    return autoBalance ? distributeEvenly(next, total) : next;
  });
  const updateEcheance = (i: number, field: string, value: string) => {
    if (field === "montant") setAutoBalance(false);
    setEcheances((p) => p.map((e, idx) => {
      if (idx !== i) return e;
      const updated = { ...e, [field]: value };
      if (field === "montant") updated.manualMontant = true;
      if (field === "label" && !autoBalance && !e.manualMontant && total > 0) {
        const pct = Number(value.match(/(\d+)\s*%/)?.[1] ?? 0);
        if (pct > 0) updated.montant = String(Math.round(total * pct) / 100);
      }
      return updated;
    }));
  };
  const recalcEcheance = (i: number) =>
    setEcheances((p) => p.map((e, idx) => {
      if (idx !== i) return e;
      const pct = Number(e.label.match(/(\d+)\s*%/)?.[1] ?? 0);
      return pct > 0 && total > 0 ? { ...e, montant: String(Math.round(total * pct) / 100), manualMontant: false } : e;
    }));
  const removeEcheance = (i: number) => {
    if (echeances.length > 1) setEcheances((p) => {
      const next = p.filter((_, idx) => idx !== i);
      const balanced = autoBalance ? distributeEvenly(next, total) : next;
      if (balanced.length === 1) return [{ ...balanced[0], label: "Solde" }];
      return balanced;
    });
  };

  // ── Save ──────────────────────────────────────────────────
  const save = async () => {
    setError("");
    if (!selectedClient) return setError("Veuillez sélectionner un client.");
    if (!selectedAbo) return setError("Veuillez sélectionner un abonnement.");
    if (items.some((i) => i.price < 0)) return setError("Le prix ne peut pas être négatif.");
    if (useEcheancier) {
      if (echeances.some((e) => !e.date)) return setError("Chaque échéance doit avoir une date.");
      if (Math.abs(echeanceSum - total) > 0.01) return setError(`Le total des échéances (${fmtMoney(echeanceSum)} €) ne correspond pas au total (${fmtMoney(total)} €).`);
    }

    setSaving(true);
    try {
      const builtEcheances: Echeance[] | undefined = useEcheancier
        ? echeances.map((e) => ({ label: e.label, date: Timestamp.fromDate(new Date(e.date)), montant: Number(e.montant) || 0, statut: "en_attente" as const }))
        : undefined;

      const dateTs = documentDate ? Timestamp.fromDate(new Date(documentDate)) : undefined;
      const ref = await createFacture({
        userId: currentUser!.uid,
        clientId: selectedClient.id,
        clientName: [selectedClient.nom, selectedClient.prenom].filter(Boolean).join(" "),
        clientLinkedUserId: (selectedClient as any).linkedUserId ?? undefined,
        clientAddress: selectedClient.adresse,
        clientVille: selectedClient.ville,
        clientCodePostal: selectedClient.codePostal,
        ...(() => {
          const contacts = (selectedClient as any).contactsSupplementaires as import("@/types").ContactSupplementaire[] | undefined ?? [];
          if (factureMode === "contact" && contacts[selectedContactIdx]) {
            const c = contacts[selectedContactIdx];
            return {
              factureNom: [c.nom, c.prenom].filter(Boolean).join(" ") || c.label || undefined,
              factureAdresse: c.adresse || undefined,
              factureCodePostal: c.codePostal || undefined,
              factureVille: c.ville || undefined,
              factureEmail: c.email || undefined,
            };
          }
          if (factureMode === "manual" && manualFactureNom.trim()) {
            return {
              factureNom: manualFactureNom.trim() || undefined,
              factureAdresse: manualFactureAdresse.trim() || undefined,
              factureCodePostal: manualFactureCodePostal.trim() || undefined,
              factureVille: manualFactureVille.trim() || undefined,
            };
          }
          return {};
        })(),
        companyId: selectedAbo.companyId,
        companyNom: selectedAbo.companyNom,
        abonnementId: selectedAbo.id,
        abonnementTitre: aboDisplayName(selectedAbo),
        items, total, type: docType,
        notes: notes.trim() || undefined,
        ...(dateTs ? { date: dateTs } : {}),
        ...(builtEcheances ? { echeances: builtEcheances } : {}),
      });
      router.push(`/facturation/${ref.id}`);
    } catch {
      setError("Erreur lors de la création. Réessayez.");
      setSaving(false);
    }
  };

  const company = selectedAbo ? companies.find((c) => c.id === selectedAbo.companyId) : null;
  const label = docType === "devis" ? "devis" : "facture";

  return (
    <>
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        {/* HEADER */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push(`/facturation${docType === "devis" ? "?tab=devis" : ""}`)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-500 transition">←</button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {docType === "devis" ? "Nouveau devis" : "Nouvelle facture"}
            </h1>
            <p className="text-sm text-gray-500">Client → Abonnement → Prestations</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* TYPE + DATE */}
          <div className="bg-white border rounded-xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Type de document</h2>
            <div className="flex gap-2 mb-4">
              {(["facture", "devis"] as const).map((t) => (
                <button key={t} onClick={() => setDocType(t)} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition border ${docType === t ? "bg-blue-600 text-white border-blue-600" : "text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                  {t === "facture" ? "Facture" : "Devis"}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date du document</label>
              <input type="date" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} className="border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition" />
              <p className="text-xs text-gray-400 mt-1">Modifiable si envoi différé</p>
            </div>
          </div>

          {/* ÉTAPE 1 : CLIENT */}
          <div className="bg-white border rounded-xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">1. Client</h2>
            <p className="text-xs text-gray-400 mb-3">Recherchez et sélectionnez un client</p>

            {selectedClient ? (
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center font-semibold text-xs shrink-0">
                  {((selectedClient.prenom?.[0] ?? "") + (selectedClient.nom?.[0] ?? "")).toUpperCase() || "?"}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{selectedClient.nom} {selectedClient.prenom}</div>
                  {selectedClient.email && <div className="text-xs text-gray-500">{selectedClient.email}</div>}
                </div>
                <button onClick={() => { setSelectedClient(null); setSelectedAbo(null); setItems([{ label: "", quantity: 1, price: 0 }]); }} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Changer</button>
              </div>
            ) : (
              <div>
                <input
                  className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition mb-2"
                  placeholder="Rechercher par nom ou email..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  onFocus={() => setClientFocused(true)}
                  onBlur={() => setTimeout(() => setClientFocused(false), 150)}
                />
                {(clientFocused || clientSearch) && (
                  <div className="border rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    {loadingClients ? (
                      <div className="p-4 text-center text-sm text-gray-400">Chargement…</div>
                    ) : (
                      <>
                        {filteredClients.length === 0 && (
                          <div className="px-4 py-3 text-sm text-gray-400">Aucun résultat</div>
                        )}
                        {filteredClients.map((c) => (
                          <div key={c.id} onMouseDown={() => handleSelectClient(c)} className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b last:border-0 transition">
                            <div className="font-medium text-sm text-gray-900">{c.nom} {c.prenom}</div>
                            {c.email && <div className="text-xs text-gray-500">{c.email}</div>}
                          </div>
                        ))}
                        <div onMouseDown={() => { setShowClientModal(true); setClientFocused(false); }}
                          className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-sm text-blue-600 font-medium border-t flex items-center gap-1.5">
                          + Nouveau client
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* FACTURER À */}
          {selectedClient && (() => {
            const contacts = (selectedClient as any).contactsSupplementaires as import("@/types").ContactSupplementaire[] | undefined ?? [];
            return (
              <div className="bg-white border rounded-xl shadow-sm p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Facturer à</h2>
                <div className="flex flex-wrap gap-2 mb-3">
                  {(["client", ...(contacts.length ? ["contact"] : []), "manual"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setFactureMode(mode as typeof factureMode)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${factureMode === mode ? "bg-blue-600 text-white border-blue-600" : "text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                    >
                      {mode === "client" ? "Client" : mode === "contact" ? "Contact enregistré" : "Autre (saisie libre)"}
                    </button>
                  ))}
                </div>

                {factureMode === "client" && (
                  <p className="text-xs text-gray-400">La facture sera au nom de <span className="font-medium text-gray-700">{[selectedClient.nom, selectedClient.prenom].filter(Boolean).join(" ")}</span> avec son adresse habituelle.</p>
                )}

                {factureMode === "contact" && contacts.length > 0 && (
                  <div className="space-y-2">
                    {contacts.map((c, i) => (
                      <label key={i} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${selectedContactIdx === i ? "bg-blue-50 border-blue-300" : "border-gray-200 hover:bg-gray-50"}`}>
                        <input type="radio" name="contact" checked={selectedContactIdx === i} onChange={() => setSelectedContactIdx(i)} className="mt-0.5 accent-blue-600" />
                        <div>
                          {c.label && <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium mb-0.5 inline-block">{c.label}</span>}
                          <p className="text-sm font-medium text-gray-800">{[c.nom, c.prenom].filter(Boolean).join(" ")}</p>
                          {(c.adresse || c.ville) && <p className="text-xs text-gray-500">{[c.adresse, [c.codePostal, c.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</p>}
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {factureMode === "manual" && (
                  <div className="space-y-2">
                    <input type="text" placeholder="Nom / Raison sociale *" value={manualFactureNom} onChange={(e) => setManualFactureNom(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                    <input type="text" placeholder="Adresse" value={manualFactureAdresse} onChange={(e) => setManualFactureAdresse(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" placeholder="Code postal" value={manualFactureCodePostal} onChange={(e) => setManualFactureCodePostal(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                      <input type="text" placeholder="Ville" value={manualFactureVille} onChange={(e) => setManualFactureVille(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ÉTAPE 2 : ABONNEMENT */}
          {selectedClient && (
            <div className="bg-white border rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold text-gray-700">2. Abonnement</h2>
                {!showAddAbo && (
                  <button
                    type="button"
                    onClick={() => setShowAddAbo(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium transition"
                  >
                    + Nouvel abonnement
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 mb-3">Choisissez l'abonnement concerné — définit automatiquement la société</p>

              {loadingAbo ? (
                <div className="text-sm text-gray-400">Chargement des abonnements…</div>
              ) : (
                <>
                  {sortedAbos.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                      {sortedAbos.map((a) => {
                        const displayName = aboDisplayName(a);
                        return (
                          <button
                            key={a.id}
                            onClick={() => selectAbo(a)}
                            className={`text-left p-3 rounded-lg border transition ${selectedAbo?.id === a.id ? "bg-blue-50 border-blue-400" : "hover:bg-gray-50 border-gray-200"}`}
                          >
                            <div className="font-medium text-sm text-gray-900">{displayName}</div>
                            <div className="text-xs text-blue-600 mt-0.5">{a.companyNom}</div>
                            {a.typeSuivi && <div className="text-xs text-gray-500">{a.typeSuivi}{a.frequence ? ` · ${a.frequence}` : ""}</div>}
                            {a.tarifUnitaire != null && a.tarifUnitaire > 0 && (
                              <div className="text-xs font-semibold text-gray-700 mt-1">{a.tarifUnitaire} € {a.tarifLabel ?? ""}</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {sortedAbos.length === 0 && !showAddAbo && (
                    <p className="text-sm text-gray-400">Aucun abonnement pour ce client. Utilisez le bouton ci-dessus pour en créer un.</p>
                  )}
                </>
              )}

              {/* Société auto-détectée */}
              {selectedAbo && company && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                  <div className="w-5 h-5 rounded flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: company.couleurPrimaire ?? "#2563eb" }}>
                    {company.nom[0]}
                  </div>
                  <span className="text-xs text-green-700 font-medium">Facturation : <strong>{company.nom}</strong></span>
                </div>
              )}
            </div>
          )}

          {/* ÉTAPE 3 : PRESTATIONS */}
          {selectedAbo && (
            <>
              <div className="bg-white border rounded-xl shadow-sm p-5">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-700">3. Prestations</h2>
                    <p className="text-xs text-gray-400">Modifiez ou ajoutez des lignes</p>
                  </div>
                  <button onClick={addItem} className="text-sm text-blue-600 hover:text-blue-800 font-medium transition">+ Ajouter</button>
                </div>
                {/* En-têtes colonnes — desktop uniquement */}
                <div className="hidden sm:flex items-center gap-2 px-1 mb-1 text-xs text-gray-400 font-medium uppercase tracking-wide">
                  <span className="flex-1">Description</span>
                  <span className="w-14 text-center">Qté</span>
                  <span className="w-24 text-right">Prix unit.</span>
                  <span className="w-20 text-right">Total</span>
                  <span className="w-8" />
                  <span className="w-8" />
                </div>
                <div className="space-y-3">
                  {items.map((item, i) => {
                    const net = itemNetTotal(item);
                    return (
                      <div key={i} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 space-y-2.5">
                        {/* Ligne principale : empilée mobile, à plat desktop */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                          {/* Description — pleine largeur mobile, flex-1 desktop */}
                          <div className="w-full sm:w-auto sm:flex-1 min-w-0">
                            <SuggestDropdown
                              value={item.label}
                              onChange={(v) => updateItem(i, "label", v)}
                              options={allPrestations}
                              placeholder="Ex : Séance coaching individuel"
                              wrapperClassName="w-full"
                              inputClassName="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition bg-white"
                              onCommit={(v) => {
                                addCustomLabel(v);
                                const stored = priceMap[v.trim()];
                                if (stored !== undefined) updateItem(i, "price", stored);
                              }}
                              removableLabels={customLabels}
                              onRemoveOption={removeCustomLabel}
                            />
                          </div>
                          {/* Qté */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs text-gray-400 sm:hidden">Qté</span>
                            <input className="w-14 border rounded-lg px-2 py-2.5 text-sm text-center outline-none focus:border-blue-400 transition bg-white" type="number" min="1" value={item.quantity} onChange={(e) => updateItem(i, "quantity", Math.max(1, Number(e.target.value)))} />
                          </div>
                          {/* Prix */}
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-xs text-gray-400 sm:hidden">Prix</span>
                            <input className="w-24 border rounded-lg px-2 py-2.5 text-sm text-right outline-none focus:border-blue-400 transition bg-white" type="number" min="0" step="0.01" value={item.price} onChange={(e) => updateItem(i, "price", Number(e.target.value))} />
                            {/* Pin tarif par défaut */}
                            {item.label.trim() && (() => {
                              const saved = priceMap[item.label.trim()];
                              const isSaved = saved === item.price;
                              return (
                                <button
                                  type="button"
                                  onClick={() => isSaved ? removePriceForLabel(item.label) : savePriceForLabel(item.label, item.price)}
                                  title={isSaved ? "Tarif mémorisé — cliquer pour oublier" : "Mémoriser ce tarif pour ce libellé"}
                                  className={`shrink-0 w-6 h-6 flex items-center justify-center rounded transition ${isSaved ? "text-amber-500 hover:text-gray-400" : "text-gray-300 hover:text-amber-500"}`}
                                >
                                  <svg className="w-3.5 h-3.5" fill={isSaved ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                  </svg>
                                </button>
                              );
                            })()}
                          </div>
                          {/* Total net */}
                          <span className="ml-auto sm:ml-0 shrink-0 text-sm font-bold text-gray-900 sm:w-20 sm:text-right">{fmtMoney(net)}</span>
                          {/* Dupliquer */}
                          <button
                            type="button"
                            onClick={() => duplicateItem(i)}
                            title="Dupliquer cette ligne"
                            className="shrink-0 w-8 h-8 flex items-center justify-center text-gray-300 hover:text-blue-500 transition rounded-lg hover:bg-blue-50"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                          {/* Supprimer */}
                          <button onClick={() => removeItem(i)} disabled={items.length === 1} className="shrink-0 w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 disabled:opacity-0 transition rounded-lg hover:bg-red-50">✕</button>
                        </div>
                        {/* Ligne remise */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 shrink-0">Remise :</span>
                          <button
                            type="button"
                            onClick={() => setItems((p) => p.map((it, idx) => idx === i ? { ...it, discountType: it.discountType === "amount" ? "percent" : "amount" } : it))}
                            className="px-2 py-1 rounded border text-xs font-medium text-gray-600 hover:bg-gray-100 shrink-0 bg-white"
                          >
                            {item.discountType === "amount" ? "€" : "%"}
                          </button>
                          <input
                            type="number" min="0" step="0.01" placeholder="0"
                            value={item.discountValue || ""}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setItems((p) => p.map((it, idx) => idx === i ? { ...it, discountValue: v, discountType: it.discountType ?? "percent" } : it));
                            }}
                            className="w-20 border rounded-lg px-2 py-1.5 text-xs text-right outline-none focus:border-blue-400 bg-white"
                          />
                          {item.discountValue ? (
                            <span className="text-xs text-orange-500 flex-1 text-right">
                              {item.discountType === "percent"
                                ? `-${item.discountValue}% = -${fmtMoney(item.quantity * item.price * item.discountValue / 100)}`
                                : `-${fmtMoney(item.discountValue)}`}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-5 pt-4 border-t space-y-2">
                  {totalDiscount > 0.001 && (
                    <>
                      <div className="flex justify-between items-center text-sm text-gray-500">
                        <span>Sous-total brut</span>
                        <span>{fmtMoney(totalGross)} €</span>
                      </div>
                      <div className="flex justify-between items-center text-sm text-orange-500 font-medium">
                        <span>Remise totale</span>
                        <span>- {fmtMoney(totalDiscount)} €</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Total HT</span>
                    <span className="text-xl font-bold text-gray-900">{fmtMoney(total)} €</span>
                  </div>
                </div>
              </div>

              {/* ÉCHÉANCIER */}
              <div className="bg-white border rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-700">Échéancier</h2>
                    <p className="text-xs text-gray-400">Fractionner le paiement</p>
                  </div>
                  <button onClick={toggleEcheancier} className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${useEcheancier ? "bg-blue-600" : "bg-gray-200"}`}>
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${useEcheancier ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
                {useEcheancier && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="grid grid-cols-12 gap-2 px-1 text-xs text-gray-400 font-medium flex-1">
                        <span className="col-span-4">Libellé</span><span className="col-span-4">Date</span><span className="col-span-3 text-right">Montant</span><span className="col-span-1" />
                      </div>
                      <div className="ml-2 shrink-0">
                        {autoBalance && total > 0 && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Auto</span>
                        )}
                        {!autoBalance && total > 0 && (
                          <button
                            type="button"
                            onClick={() => { setAutoBalance(true); setEcheances((p) => distributeEvenly(p, total)); }}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 px-2.5 py-0.5 rounded-full transition"
                          >
                            Rééquilibrer
                          </button>
                        )}
                      </div>
                    </div>
                    {echeances.map((e, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4">
                          <EcheanceLabelInput
                            value={e.label}
                            onChange={(v) => updateEcheance(i, "label", v)}
                            placeholder="Ex : Acompte"
                            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 transition"
                          />
                        </div>
                        <input type="date" className="col-span-4 border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 transition" value={e.date} onChange={(ev) => updateEcheance(i, "date", ev.target.value)} />
                        <div className="col-span-3 flex items-center gap-1">
                          <input type="number" min="0" step="0.01" className="flex-1 min-w-0 border rounded-lg px-3 py-2 text-sm text-right outline-none focus:border-blue-400 transition" placeholder="0.00" value={e.montant} onChange={(ev) => updateEcheance(i, "montant", ev.target.value)} />
                          {e.manualMontant && !autoBalance && /\d+\s*%/.test(e.label) && (
                            <button type="button" onClick={() => recalcEcheance(i)} title="Recalculer d'après le %" className="shrink-0 text-blue-500 hover:text-blue-700 text-base leading-none">↻</button>
                          )}
                          {e.montant && (
                            <button type="button" onClick={() => setCopiedMontant(copiedMontant === e.montant ? null : e.montant)} title={copiedMontant === e.montant ? "Copié — cliquer pour effacer" : "Copier ce montant"} className={`shrink-0 transition ${copiedMontant === e.montant ? "text-blue-500" : "text-gray-300 hover:text-gray-500"}`}>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            </button>
                          )}
                          {copiedMontant !== null && copiedMontant !== e.montant && (
                            <button type="button" onClick={() => { updateEcheance(i, "montant", copiedMontant); setAutoBalance(false); }} title={`Coller ${copiedMontant} €`} className="shrink-0 text-blue-400 hover:text-blue-600 transition">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                            </button>
                          )}
                        </div>
                        <button onClick={() => removeEcheance(i)} disabled={echeances.length === 1} className="col-span-1 flex justify-center text-gray-300 hover:text-red-500 disabled:opacity-0 transition">✕</button>
                      </div>
                    ))}
                    <button onClick={addEcheance} className="text-sm text-blue-600 hover:text-blue-800 font-medium transition mt-1">+ Ajouter une échéance</button>
                    <div className="pt-3 border-t flex justify-between text-sm">
                      <span className="text-gray-500">Total échéances</span>
                      <span className={`font-semibold ${Math.abs(echeanceSum - total) > 0.01 ? "text-red-500" : "text-green-600"}`}>
                        {fmtMoney(echeanceSum)} € {Math.abs(echeanceSum - total) > 0.01 && `(manque ${fmtMoney(total - echeanceSum)} €)`}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* NOTES */}
              <div className="bg-white border rounded-xl shadow-sm p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-1">Notes</h2>
                <textarea rows={3} className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition resize-none" placeholder="Conditions de paiement, mentions légales…" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">{error}</div>}

              <div className="flex gap-3 pb-6">
                <button onClick={() => router.push(`/facturation${docType === "devis" ? "?tab=devis" : ""}`)} className="flex-1 border rounded-lg py-3 text-sm font-medium text-gray-600 hover:bg-gray-100 transition">Annuler</button>
                <button onClick={save} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg py-3 text-sm font-semibold transition">
                  {saving ? "Création en cours..." : `Créer le ${label}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>

    <ClientEditModal
      client={null}
      isOpen={showClientModal}
      onClose={() => setShowClientModal(false)}
      onSaved={() => setPendingAutoSelect(true)}
      isSC={true}
    />
    {selectedClient && (
      <AbonnementModal
        isOpen={showAddAbo}
        onClose={() => setShowAddAbo(false)}
        onSaved={(id) => { setPendingAboId(id); setShowAddAbo(false); }}
        clientId={selectedClient.id}
        userId={currentUser?.uid ?? ""}
        defaultObjectifs={(selectedClient as any).objectifs}
      />
    )}
    </>
  );
}
