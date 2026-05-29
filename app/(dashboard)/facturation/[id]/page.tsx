"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useCustomPrestations } from "@/hooks/useCustomPrestations";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  getFacture, updateFacture, deleteFacture, convertDevisToFacture,
} from "@/lib/facturationService";
import { getCompany } from "@/lib/companyService";
import { getClient } from "@/lib/clientService";
import { downloadInvoicePDF, generateInvoicePDFBlob, itemNetTotal } from "@/lib/invoicePdf";
import { uploadBlob } from "@/lib/uploadImage";
import { addToCalendar, BILLING_CAL_ID } from "@/lib/googleCalendar";
import { Timestamp } from "firebase/firestore";
import type { Facture, FactureItem, FactureStatus, Echeance, EcheanceRef, Company, Client } from "@/types";

// ── Prestations suggestions ───────────────────────────────────────────────────

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

const ECHEANCE_LABELS = [
  "Acompte 30 %", "Acompte 40 %", "Acompte 50 %",
  "Acompte 60 %", "Acompte 70 %", "Acompte 100 %",
  "Solde", "Paiement comptant",
  "1ère mensualité", "2ème mensualité", "3ème mensualité", "4ème mensualité", "5ème mensualité", "6ème mensualité", "7ème mensualité", "8ème mensualité", "9ème mensualité", "10ème mensualité",
];

function SuggestDropdown({ value, onChange, options, placeholder, wrapperClassName, inputClassName, onCommit, removableLabels, onRemoveOption }: {
  value: string; onChange: (v: string) => void; options: string[];
  placeholder?: string; wrapperClassName?: string; inputClassName?: string;
  onCommit?: (v: string) => void;
  removableLabels?: string[]; onRemoveOption?: (label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() =>
    value.trim() ? options.filter((s) => s.toLowerCase().includes(value.toLowerCase())) : options,
    [value, options]
  );

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

// ── Constantes ────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<FactureStatus, string> = {
  draft: "Brouillon", sent: "En attente", paid: "Payée",
  overdue: "En retard", cancelled: "Annulée", accepted: "Accepté", rejected: "Non validé",
};
const STATUS_STYLE: Record<FactureStatus, string> = {
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-green-50 text-green-700 border-green-200",
  overdue: "bg-red-50 text-red-700 border-red-200",
  cancelled: "bg-gray-100 text-gray-400 border-gray-200",
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-orange-50 text-orange-700 border-orange-200",
};
const STATUSES_FACTURE: FactureStatus[] = ["draft", "sent", "paid", "overdue", "cancelled"];
const STATUSES_DEVIS: FactureStatus[] = ["draft", "sent", "accepted", "rejected", "cancelled"];

const STATUS_DOT: Record<FactureStatus, string> = {
  draft: "bg-gray-400",
  sent: "bg-blue-500",
  paid: "bg-green-500",
  overdue: "bg-red-500",
  cancelled: "bg-gray-300",
  accepted: "bg-emerald-500",
  rejected: "bg-orange-500",
};

function StatusSelect({ current, statuses, onChange }: {
  current: FactureStatus;
  statuses: FactureStatus[];
  onChange: (s: FactureStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition ${STATUS_STYLE[current]}`}
      >
        {STATUS_LABEL[current]}
        <svg className={`w-3 h-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden min-w-[170px]">
          {statuses.map((s) => {
            const isCurrent = s === current;
            return (
              <button
                key={s}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { if (!isCurrent) { onChange(s); } setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition border-b border-gray-50 last:border-0 ${
                  isCurrent
                    ? "bg-gray-50 cursor-default"
                    : "hover:bg-gray-50 cursor-pointer"
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[s]}`} />
                <span className={`font-medium ${isCurrent ? "text-gray-900" : "text-gray-700"}`}>
                  {STATUS_LABEL[s]}
                </span>
                {isCurrent && (
                  <span className="ml-auto text-[10px] font-semibold text-gray-400 uppercase tracking-wide">actuel</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function fmtDate(ts?: { seconds: number } | null) {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
  });
}
function fmtDateShort(ts?: { seconds: number } | null) {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleDateString("fr-FR");
}
function fmtMoney(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €";
}
function calNum(number: string) {
  return number.replace(/^FAC_/, 'Fac ').replace(/^DEV_/, 'Dev ')
}
function toDateInputValue(ts?: { seconds: number } | null) {
  if (!ts) return "";
  return new Date(ts.seconds * 1000).toISOString().split("T")[0];
}

// ── Google Agenda ─────────────────────────────────────────────────────────────

async function addCalEvent(
  title: string, date: Date, details: string,
  setToast: (t: { msg: string; ok: boolean } | null) => void
) {
  try {
    const dateAt12 = new Date(date);
    dateAt12.setHours(12, 0, 0, 0);
    const end = new Date(dateAt12.getTime() + 60 * 60 * 1000);
    await addToCalendar(BILLING_CAL_ID, { summary: title, start: dateAt12, end, description: details });
    setToast({ msg: "Événement ajouté à Google Agenda !", ok: true });
  } catch (e: any) {
    setToast({ msg: e.message?.includes("GOOGLE_CLIENT_ID") ? "Clé Google manquante (voir .env.local)" : "Erreur Google Agenda", ok: false });
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FactureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { currentUser } = useAuth();

  const [facture, setFacture] = useState<Facture | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [editingNumber, setEditingNumber] = useState(false);
  const [draftNumber, setDraftNumber] = useState("");
  const { allLabels: allPrestations, customLabels, addCustomLabel, removeCustomLabel } = useCustomPrestations(PRESTATIONS_LABELS, currentUser?.uid);
  const [items, setItems] = useState<FactureItem[]>([]);
  const [echeances, setEcheances] = useState<Echeance[]>([]);
  const [notes, setNotes] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmConvert, setConfirmConvert] = useState(false);
  const [signModal, setSignModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Facturer à (override coordonnées)
  const [factureNom, setFactureNom] = useState("");
  const [factureAdresse, setFactureAdresse] = useState("");
  const [factureCodePostal, setFactureCodePostal] = useState("");
  const [factureVille, setFactureVille] = useState("");
  const [showFactureA, setShowFactureA] = useState(false);

  useEffect(() => {
    getFacture(id).then((data) => {
      setFacture(data);
      setDraftNumber(data.number ?? "");
      setItems(data.items ?? []);
      setEcheances(data.echeances ?? []);
      setNotes(data.notes ?? "");
      setDocumentDate(toDateInputValue(data.date ?? data.createdAt ?? null));
      setFactureNom(data.factureNom ?? "");
      setFactureAdresse(data.factureAdresse ?? "");
      setFactureCodePostal(data.factureCodePostal ?? "");
      setFactureVille(data.factureVille ?? "");
      if (data.factureNom) setShowFactureA(true);
      if (data.companyId) getCompany(data.companyId).then(setCompany).catch(() => null);
      if (data.clientId) getClient(data.clientId).then(setClient).catch(() => null);
    });
  }, [id]);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Items ─────────────────────────────────────────────────
  const updateItem = (i: number, field: keyof FactureItem, value: string | number) =>
    setItems((p) => p.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));
  const addItem = () => setItems((p) => [...p, { label: "", quantity: 1, price: 0 }]);
  const removeItem = (i: number) => { if (items.length > 1) setItems((p) => p.filter((_, idx) => idx !== i)); };
  const toggleDiscountType = (i: number) =>
    setItems((p) => p.map((it, idx) =>
      idx === i ? { ...it, discountType: it.discountType === "percent" ? "amount" : "percent" } : it
    ));

  // ── Échéancier ────────────────────────────────────────────
  const toggleEcheance = (i: number) =>
    setEcheances((p) =>
      p.map((e, idx) => idx === i ? { ...e, statut: e.statut === "payé" ? "en_attente" : "payé" } : e)
    );

  type DraftEcheance = { label: string; date: string; montant: string; manualMontant?: boolean };
  const [showEcheancierBuilder, setShowEcheancierBuilder] = useState(false);
  const [draftEcheances, setDraftEcheances] = useState<DraftEcheance[]>([
    { label: "Acompte 50%", date: "", montant: "" },
    { label: "Solde 50%", date: "", montant: "" },
  ]);
  const [autoBalance, setAutoBalance] = useState(true);

  const distributeEvenly = (rows: DraftEcheance[], t: number): DraftEcheance[] => {
    if (rows.length === 0 || t <= 0) return rows;
    const share = Math.floor((t / rows.length) * 100) / 100;
    const last = Math.round((t - share * (rows.length - 1)) * 100) / 100;
    return rows.map((e, idx) => ({ ...e, montant: String(idx === rows.length - 1 ? last : share), manualMontant: false }));
  };

  const updateDraft = (i: number, field: keyof DraftEcheance, value: string) => {
    if (field === "montant") setAutoBalance(false);
    setDraftEcheances((p) => p.map((e, idx) =>
      idx === i ? { ...e, [field]: value, ...(field === "montant" ? { manualMontant: true } : {}) } : e
    ));
  };
  const addDraftRow = () =>
    setDraftEcheances((p) => {
      const next = [...p, { label: "", date: "", montant: "" }];
      return autoBalance ? distributeEvenly(next, total) : next;
    });
  const removeDraftRow = (i: number) =>
    setDraftEcheances((p) => {
      const next = p.filter((_, idx) => idx !== i);
      return autoBalance ? distributeEvenly(next, total) : next;
    });

  const recalcDraft = (i: number) => {
    setDraftEcheances((p) => p.map((e, idx) => {
      if (idx !== i) return e;
      const pct = Number(e.label.match(/(\d+)\s*%/)?.[1] ?? 0);
      return pct > 0 ? { ...e, montant: String(Math.round(total * pct) / 100), manualMontant: false } : e;
    }));
  };

  const applyEcheancierBuilder = async () => {
    const converted: Echeance[] = draftEcheances.map((e) => ({
      label: e.label,
      date: e.date ? Timestamp.fromDate(new Date(e.date)) : Timestamp.now(),
      montant: Number(e.montant) || 0,
      statut: "en_attente" as const,
    }));
    setEcheances(converted);
    setShowEcheancierBuilder(false);
    setSaving(true);
    try {
      const dateTs = documentDate ? Timestamp.fromDate(new Date(documentDate)) : undefined;
      await updateFacture(id, { items, total, echeances: converted, notes, ...(dateTs ? { date: dateTs } : {}) });
      setFacture((p) => p ? { ...p, items, total, echeances: converted, notes } : null);
      showToast("Échéancier créé.");
    } catch { showToast("Erreur lors de l'enregistrement.", false); }
    finally { setSaving(false); }
  };

  const openEditEcheancier = () => {
    setAutoBalance(false);
    setDraftEcheances(echeances.map((e) => ({
      label: e.label ?? "",
      date: e.date ? new Date(e.date.seconds * 1000).toISOString().split("T")[0] : "",
      montant: String(e.montant),
      manualMontant: true,
    })));
    setShowEcheancierBuilder(true);
  };

  const deleteEcheancier = async () => {
    if (!window.confirm("Supprimer l'échéancier ?")) return;
    setEcheances([]);
    setSaving(true);
    try {
      await updateFacture(id, { echeances: [] });
      setFacture((p) => p ? { ...p, echeances: [] } : null);
      showToast("Échéancier supprimé.");
    } catch { showToast("Erreur lors de la suppression.", false); }
    finally { setSaving(false); }
  };

  const echeanceRef = (facture as any)?.echeanceRef as EcheanceRef | undefined;
  const itemsTotal = items.reduce((acc, i) => acc + itemNetTotal(i), 0);
  // Factures issues d'un devis à échéancier : le total à facturer est l'échéance, pas la somme des lignes
  const total = echeanceRef ? echeanceRef.montant : itemsTotal;
  const paidTotal = echeances.filter((e) => e.statut === "payé").reduce((s, e) => s + e.montant, 0);
  const pendingTotal = echeances.filter((e) => e.statut !== "payé").reduce((s, e) => s + e.montant, 0);

  // ── Save ──────────────────────────────────────────────────
  const save = async () => {
    setSaving(true);
    try {
      const dateTs = documentDate ? Timestamp.fromDate(new Date(documentDate)) : undefined;
      await updateFacture(id, {
        items, total, echeances, notes,
        ...(echeanceRef ? { echeanceRef } : {}),
        ...(dateTs ? { date: dateTs } : {}),
        factureNom: factureNom.trim() || undefined,
        factureAdresse: factureAdresse.trim() || undefined,
        factureCodePostal: factureCodePostal.trim() || undefined,
        factureVille: factureVille.trim() || undefined,
      });
      setFacture((p) => p ? { ...p, items, total, echeances, notes, ...(dateTs ? { date: dateTs } : {}) } : null);
      showToast("Sauvegardé");
    } catch {
      showToast("Erreur lors de la sauvegarde", false);
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (status: FactureStatus) => {
    try {
      await updateFacture(id, { status });
      setFacture((p) => p ? { ...p, status } : null);
      showToast(`Statut : ${STATUS_LABEL[status]}`);
    } catch {
      showToast("Erreur lors du changement de statut", false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteFacture(id);
      router.push("/facturation");
    } catch {
      showToast("Erreur lors de la suppression", false);
    }
  };

  const handleConvert = async () => {
    if (!facture) return;
    try {
      const ids = await convertDevisToFacture(id, currentUser!.uid);
      showToast(ids.length > 1 ? `Devis converti en ${ids.length} factures !` : "Devis converti en facture !");
      router.push(`/facturation/${ids[0]}`);
    } catch {
      showToast("Erreur lors de la conversion", false);
    } finally {
      setConfirmConvert(false);
    }
  };

  const handleSignConfirm = async (dataUrl: string) => {
    try {
      const arr = dataUrl.split(",");
      const mime = arr[0].match(/:(.*?);/)?.[1] ?? "image/png";
      const bytes = atob(arr[1]);
      const u8 = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) u8[i] = bytes.charCodeAt(i);
      const blob = new Blob([u8], { type: mime });
      const signatureUrl = await uploadBlob(blob, `users/${currentUser!.uid}/signatures/${id}.png`);
      const now = Timestamp.now();
      await updateFacture(id, { signed: true, signedAt: now, signatureUrl });
      setFacture((p) => p ? { ...p, signed: true, signedAt: now, signatureUrl } : null);
      setSignModal(false);
      showToast("Devis signé !");
    } catch {
      showToast("Erreur lors de la signature", false);
    }
  };

  const handleUploadAndShare = async () => {
    if (!facture) return;
    setPdfUploading(true);
    try {
      const snapshot: Facture = { ...facture, items, total, echeances, notes };
      const blob = await generateInvoicePDFBlob(snapshot, company);
      const pdfUrl = await uploadBlob(blob, `users/${currentUser!.uid}/factures/${id}.pdf`);
      const updates: Partial<Omit<Facture, "id">> = { pdfUrl };
      if (facture.status === "draft") updates.status = "sent";
      await updateFacture(id, updates);
      setFacture((p) => p ? { ...p, ...updates } : null);
      showToast("PDF prêt à partager !");
    } catch {
      showToast("Erreur lors de l'upload du PDF", false);
    } finally {
      setPdfUploading(false);
    }
  };

  const handlePDF = async () => {
    if (!facture) return;
    setGeneratingPdf(true);
    try {
      let newStatus = facture.status;
      if (facture.status === "draft") {
        await updateFacture(id, { status: "sent" });
        setFacture((p) => p ? { ...p, status: "sent" } : null);
        newStatus = "sent";
      }
      const dateTs = documentDate ? Timestamp.fromDate(new Date(documentDate)) : undefined;
      const snapshot: Facture = { ...facture, status: newStatus, items, total, echeances, notes, ...(dateTs ? { date: dateTs } : {}) };
      await downloadInvoicePDF(snapshot, company);
    } catch {
      showToast("Erreur lors de la génération du PDF", false);
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (!facture) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isDevis = facture.type === "devis";
  const docLabel = isDevis ? "Devis" : "Facture";
  const docDate = documentDate ? new Date(documentDate) : (facture.createdAt ? new Date(facture.createdAt.seconds * 1000) : new Date());

  const gcalAdd = (title: string, date: Date, details: string) =>
    addCalEvent(title, date, details, (t) => {
      setToast(t);
      if (t) setTimeout(() => setToast(null), 3500);
    });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {signModal && (
        <SignaturePad
          onConfirm={handleSignConfirm}
          onCancel={() => setSignModal(false)}
        />
      )}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${toast.ok ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.msg}
        </div>
      )}

      {/* HEADER */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/facturation${facture.type === "devis" ? "?tab=devis" : ""}`)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-500 transition">←</button>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              {editingNumber ? (
                <input
                  autoFocus
                  value={draftNumber}
                  onChange={(e) => setDraftNumber(e.target.value)}
                  onBlur={async () => {
                    setEditingNumber(false);
                    const trimmed = draftNumber.trim();
                    if (trimmed && trimmed !== facture.number) {
                      await updateFacture(id, { number: trimmed });
                      setFacture((p) => p ? { ...p, number: trimmed } : null);
                    } else {
                      setDraftNumber(facture.number);
                    }
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setDraftNumber(facture.number); setEditingNumber(false); } }}
                  className="text-xl font-semibold text-gray-900 border-b-2 border-blue-400 outline-none bg-transparent min-w-[120px]"
                />
              ) : (
                <button
                  onClick={() => setEditingNumber(true)}
                  className="group flex items-center gap-1.5"
                  title="Modifier le numéro"
                >
                  <h1 className="text-xl font-semibold text-gray-900">{facture.number}</h1>
                  <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 transition shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
              {isDevis && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">Devis</span>}
              {facture.signed && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">Signé</span>}
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLE[facture.status]}`}>{STATUS_LABEL[facture.status]}</span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {facture.clientName || "—"} · {fmtDate((facture.date ?? facture.createdAt) ?? null)}
              {facture.devisNumber && !isDevis && <span className="ml-2 text-xs text-purple-600">Réf. devis : {facture.devisNumber}</span>}
              {isDevis && facture.convertedToFactureIds && facture.convertedToFactureIds.length > 1 ? (
                <span className="ml-2 flex items-center gap-1.5 flex-wrap">
                  {facture.convertedToFactureIds.map((fid, i) => (
                    <button key={fid} onClick={() => router.push(`/facturation/${fid}`)} className="text-xs text-blue-600 hover:underline">
                      → Facture {i + 1}
                    </button>
                  ))}
                </span>
              ) : isDevis && facture.convertedToFactureId ? (
                <button onClick={() => router.push(`/facturation/${facture.convertedToFactureId}`)} className="ml-2 text-xs text-blue-600 hover:underline">
                  → Voir la facture créée
                </button>
              ) : null}
            </p>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button onClick={handlePDF} disabled={generatingPdf} className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            {generatingPdf ? "Génération…" : "PDF"}
          </button>

          {isDevis && !facture.signed && (
            <button onClick={() => setSignModal(true)} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition">
              ✍ Signer le devis
            </button>
          )}

          {isDevis && !facture.convertedToFactureId && !confirmConvert && facture.status !== 'rejected' && (
            <button onClick={() => setConfirmConvert(true)} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">
              → {echeances.length > 1 ? `Convertir en ${echeances.length} factures` : "Convertir en facture"}
            </button>
          )}
          {isDevis && confirmConvert && (
            <div className="flex gap-1.5">
              <button onClick={handleConvert} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">Confirmer</button>
              <button onClick={() => setConfirmConvert(false)} className="px-3 py-2 border rounded-lg text-sm font-medium hover:bg-gray-100 transition">Annuler</button>
            </div>
          )}

          <StatusSelect
            current={facture.status}
            statuses={isDevis ? STATUSES_DEVIS : STATUSES_FACTURE}
            onChange={changeStatus}
          />

          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} className="px-3 py-2 border border-red-200 text-red-500 rounded-lg text-sm font-medium hover:bg-red-50 transition">Supprimer</button>
          ) : (
            <div className="flex gap-1.5">
              <button onClick={handleDelete} className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition">Confirmer la suppression</button>
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-2 border rounded-lg text-sm font-medium hover:bg-gray-100 transition">Annuler</button>
            </div>
          )}
        </div>
      </div>

      {/* CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT */}
        <div className="lg:col-span-2 space-y-4">

          {/* DATE */}
          <div className="bg-white border rounded-xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Date du document</h2>
            <input
              type="date"
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
              className="border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition"
            />
            <p className="text-xs text-gray-400 mt-1.5">Modifiable (ex : facturation groupée envoyée ultérieurement)</p>
          </div>

          {/* FACTURER À */}
          {(() => {
            const contacts = (client as any)?.contactsSupplementaires as import("@/types").ContactSupplementaire[] | undefined ?? [];
            const hasOverride = !!factureNom;
            return (
              <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowFactureA((v) => !v)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700">Facturer à</span>
                    {hasOverride && (
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                        {factureNom}
                      </span>
                    )}
                  </div>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${showFactureA ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showFactureA && (
                  <div className="px-5 pb-5 space-y-3 border-t pt-4">
                    <p className="text-xs text-gray-400">
                      À utiliser si le client souhaite une facture à un autre nom ou une autre adresse (employeur, conjoint, société…). Laissez vide pour utiliser les coordonnées habituelles du client.
                    </p>
                    {contacts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => { setFactureNom(""); setFactureAdresse(""); setFactureCodePostal(""); setFactureVille(""); }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${!factureNom ? "bg-blue-600 text-white border-blue-600" : "text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                        >
                          Client
                        </button>
                        {contacts.map((c, i) => (
                          <button
                            type="button"
                            key={i}
                            onClick={() => {
                              setFactureNom([c.nom, c.prenom].filter(Boolean).join(" "));
                              setFactureAdresse(c.adresse ?? "");
                              setFactureCodePostal(c.codePostal ?? "");
                              setFactureVille(c.ville ?? "");
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${factureNom === [c.nom, c.prenom].filter(Boolean).join(" ") ? "bg-indigo-600 text-white border-indigo-600" : "text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                          >
                            {c.label || [c.nom, c.prenom].filter(Boolean).join(" ")}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder={`Nom / Raison sociale (défaut : ${facture?.clientName || "—"})`}
                        value={factureNom}
                        onChange={(e) => setFactureNom(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 transition"
                      />
                      <input
                        type="text"
                        placeholder={`Adresse (défaut : ${facture?.clientAddress || "—"})`}
                        value={factureAdresse}
                        onChange={(e) => setFactureAdresse(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 transition"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Code postal"
                          value={factureCodePostal}
                          onChange={(e) => setFactureCodePostal(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 transition"
                        />
                        <input
                          type="text"
                          placeholder="Ville"
                          value={factureVille}
                          onChange={(e) => setFactureVille(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 transition"
                        />
                      </div>
                      {hasOverride && (
                        <button
                          type="button"
                          onClick={() => { setFactureNom(""); setFactureAdresse(""); setFactureCodePostal(""); setFactureVille(""); }}
                          className="text-xs text-red-400 hover:text-red-600 transition"
                        >
                          Réinitialiser — utiliser les coordonnées du client
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ITEMS */}
          <div className="bg-white border rounded-xl shadow-sm p-5">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">Lignes de facturation</h2>
                {echeanceRef && (
                  <p className="text-xs text-gray-400 mt-0.5">Prestations du devis réf. {facture.devisNumber}</p>
                )}
              </div>
              {!echeanceRef && (
                <button onClick={addItem} className="text-sm text-blue-600 hover:text-blue-800 font-medium transition">+ Ajouter</button>
              )}
            </div>
            <div className="space-y-3">
              {items.map((item, i) => {
                const net = itemNetTotal(item);
                return (
                  <div key={i} className="space-y-1.5">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <SuggestDropdown
                        value={item.label}
                        onChange={(v) => updateItem(i, "label", v)}
                        options={allPrestations}
                        placeholder="Description"
                        wrapperClassName="col-span-5"
                        inputClassName="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition"
                        onCommit={addCustomLabel}
                        removableLabels={customLabels}
                        onRemoveOption={removeCustomLabel}
                      />
                      <input className="col-span-2 border rounded-lg px-3 py-2.5 text-sm text-center outline-none focus:border-blue-400 transition" type="number" min="1" value={item.quantity} onChange={(e) => updateItem(i, "quantity", Math.max(1, Number(e.target.value)))} />
                      <input className="col-span-2 border rounded-lg px-3 py-2.5 text-sm text-right outline-none focus:border-blue-400 transition" type="number" min="0" step="0.01" value={item.price} onChange={(e) => updateItem(i, "price", Number(e.target.value))} />
                      <span className="col-span-2 text-xs font-semibold text-gray-700 text-right pr-1">{fmtMoney(net)}</span>
                      <button onClick={() => removeItem(i)} disabled={items.length === 1} className="col-span-1 flex justify-center text-gray-300 hover:text-red-500 disabled:opacity-0 transition">✕</button>
                    </div>
                    {/* Ligne remise */}
                    <div className="grid grid-cols-12 gap-2 items-center ml-1">
                      <span className="col-span-5 text-xs text-gray-400">Remise :</span>
                      <div className="col-span-4 flex items-center gap-1">
                        <button
                          onClick={() => toggleDiscountType(i)}
                          className="px-2 py-1 rounded border text-xs font-medium text-gray-600 hover:bg-gray-100 transition shrink-0"
                          title="Basculer % / €"
                        >
                          {item.discountType === "amount" ? "€" : "%"}
                        </button>
                        <input
                          type="number" min="0" step="0.01"
                          placeholder="0"
                          value={item.discountValue || ""}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            updateItem(i, "discountValue", v);
                            if (!item.discountType) updateItem(i, "discountType", "percent");
                          }}
                          className="flex-1 border rounded-lg px-2 py-1 text-xs text-right outline-none focus:border-blue-400 transition"
                        />
                      </div>
                      {item.discountValue ? (
                        <span className="col-span-3 text-xs text-orange-500 text-right">
                          - {item.discountType === "percent"
                            ? `${item.discountValue}% = ${fmtMoney(item.quantity * item.price * item.discountValue / 100)}`
                            : fmtMoney(item.discountValue)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Footer lignes */}
            <div className="mt-4 pt-3 border-t flex justify-between items-center">
              <span className="text-sm text-gray-500">
                {echeanceRef ? "Sous-total prestations" : "Total HT"}
              </span>
              <span className={`text-lg font-bold ${echeanceRef ? "text-gray-400" : "text-gray-900"}`}>
                {fmtMoney(itemsTotal)}
              </span>
            </div>

            {/* Section "Facturation actuelle" — visible uniquement sur les factures issues d'un devis à échéancier */}
            {echeanceRef && (
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-blue-800">Facturation actuelle</h3>
                  <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2.5 py-0.5 rounded-full">
                    Échéance {echeanceRef.index + 1}/{echeanceRef.count}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-900 font-medium">{echeanceRef.label}</span>
                  <span className="text-2xl font-bold text-blue-900">{fmtMoney(echeanceRef.montant)}</span>
                </div>
                {facture.date && (
                  <p className="text-xs text-blue-500 mt-1.5">Règlement attendu le {fmtDate(facture.date)}</p>
                )}
              </div>
            )}

            <button onClick={save} disabled={saving} className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-semibold transition">
              {saving ? "Sauvegarde…" : "Sauvegarder les modifications"}
            </button>
          </div>

          {/* ÉCHÉANCIER */}
          {echeances.length > 0 && !showEcheancierBuilder && (
            <div className="bg-white border rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-700">Échéancier de paiement</h2>
                <div className="flex gap-2">
                  <button onClick={openEditEcheancier} className="text-xs text-blue-600 hover:text-blue-800 font-medium transition">Modifier</button>
                  <button onClick={deleteEcheancier} className="text-xs text-red-400 hover:text-red-600 font-medium transition">Supprimer</button>
                </div>
              </div>
              {/* Barre de progression */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span className="text-green-600 font-medium">Reçu : {fmtMoney(paidTotal)}</span>
                  <span className="text-orange-500 font-medium">Restant : {fmtMoney(pendingTotal)}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: total > 0 ? `${Math.min(100, paidTotal / total * 100)}%` : "0%" }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                {echeances.map((e, i) => {
                  const isPaid = e.statut === "payé";
                  const echDate = e.date ? new Date(e.date.seconds * 1000) : new Date();
                  return (
                    <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition ${isPaid ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200"}`}>
                      <button onClick={() => toggleEcheance(i)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${isPaid ? "bg-green-500 border-green-500" : "border-orange-400"}`} title={isPaid ? "Marquer non payé" : "Marquer payé"}>
                        {isPaid && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">{e.label || `Échéance ${i + 1}`}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{fmtDateShort(e.date ?? null)}</div>
                      </div>
                      <div className="text-sm font-semibold text-gray-900 shrink-0">{fmtMoney(e.montant)}</div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${isPaid ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                        {isPaid ? "Payé" : "En attente"}
                      </span>
                      <button
                        onClick={() => {
                          const mm = String(echDate.getMonth() + 1).padStart(2, '0')
                          const yyyy = echDate.getFullYear()
                          gcalAdd(
                            `Encaiss ${fmtMoney(e.montant)} ${facture.clientName} (${i + 1}/${echeances.length}) ${mm}/${yyyy} ${calNum(facture.number)}`,
                            echDate,
                            `Montant : ${fmtMoney(e.montant)} · ${facture.clientName}`
                          )
                        }}
                        className="shrink-0 text-gray-400 hover:text-blue-600 transition" title="Ajouter à Google Agenda"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </button>
                    </div>
                  );
                })}
              </div>
              <button onClick={save} disabled={saving} className="mt-4 w-full border border-blue-200 text-blue-600 hover:bg-blue-50 py-2 rounded-lg text-sm font-medium transition">
                {saving ? "Sauvegarde…" : "Sauvegarder l'échéancier"}
              </button>
            </div>
          )}

          {/* CRÉER / MODIFIER ÉCHÉANCIER */}
          {(echeances.length === 0 || showEcheancierBuilder) && facture && (
            <div className="bg-white border rounded-xl shadow-sm p-5">
              {!showEcheancierBuilder ? (
                <button
                  onClick={() => {
                    const initialRows: DraftEcheance[] = [
                      { label: "Acompte 50%", date: "", montant: "" },
                      { label: "Solde 50%", date: "", montant: "" },
                    ];
                    setAutoBalance(true);
                    setDraftEcheances(total > 0 ? distributeEvenly(initialRows, total) : initialRows);
                    setShowEcheancierBuilder(true);
                  }}
                  className="w-full border-2 border-dashed border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 py-3 rounded-xl text-sm font-medium transition"
                >
                  + Créer un échéancier de paiement
                </button>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-gray-700">{echeances.length > 0 ? "Modifier l'échéancier" : "Nouvel échéancier"}</h2>
                    <div className="flex items-center gap-2">
                      {autoBalance && total > 0 && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Auto</span>
                      )}
                      {!autoBalance && total > 0 && (
                        <button
                          type="button"
                          onClick={() => { setAutoBalance(true); setDraftEcheances((p) => distributeEvenly(p, total)); }}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 px-2.5 py-0.5 rounded-full transition"
                        >
                          Rééquilibrer
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    {draftEcheances.map((e, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 items-start">
                        <div className="col-span-4">
                          <SuggestDropdown
                            value={e.label}
                            onChange={(v) => {
                              updateDraft(i, "label", v);
                              if (!autoBalance && !draftEcheances[i].manualMontant) {
                                const pct = Number(v.match(/(\d+)\s*%/)?.[1] ?? 0);
                                if (pct > 0) setDraftEcheances((p) => p.map((r, idx) =>
                                  idx === i ? { ...r, label: v, montant: String(Math.round(total * pct) / 100) } : r
                                ));
                              }
                            }}
                            options={ECHEANCE_LABELS}
                            placeholder="Libellé"
                            inputClassName="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="date"
                            value={e.date}
                            onChange={(ev) => updateDraft(i, "date", ev.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                        </div>
                        <div className="col-span-3 flex items-center gap-1">
                          <input
                            type="number"
                            value={e.montant}
                            onChange={(ev) => updateDraft(i, "montant", ev.target.value)}
                            placeholder="Montant"
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                          {e.manualMontant && !autoBalance && /\d+\s*%/.test(e.label) && (
                            <button type="button" onClick={() => recalcDraft(i)} title="Recalculer d'après le %"
                              className="text-xs text-blue-500 hover:text-blue-700 px-1">↻</button>
                          )}
                        </div>
                        <div className="col-span-2 flex justify-end">
                          {draftEcheances.length > 1 && (
                            <button onClick={() => removeDraftRow(i)} className="text-gray-400 hover:text-red-500 transition p-1">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={addDraftRow} className="mt-3 text-sm text-blue-600 hover:underline">+ Ajouter une échéance</button>
                  <div className="flex gap-3 mt-4">
                    <button onClick={() => setShowEcheancierBuilder(false)} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
                      Annuler
                    </button>
                    <button onClick={applyEcheancierBuilder} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition">
                      {saving ? "Sauvegarde…" : "Appliquer l'échéancier"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* NOTES */}
          <div className="bg-white border rounded-xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Notes</h2>
            <textarea rows={3} className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition resize-none" placeholder="Conditions de paiement, mentions…" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={save} />
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-4">
          {/* RÉSUMÉ */}
          <div className="bg-white border rounded-xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Résumé</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-600"><span>Total HT</span><span>{fmtMoney(total)}</span></div>
              {echeances.length > 0 && (
                <>
                  <div className="flex justify-between text-gray-500 text-xs"><span>Reçu</span><span className="text-green-600 font-medium">{fmtMoney(paidTotal)}</span></div>
                  <div className="flex justify-between text-gray-500 text-xs"><span>Restant</span><span className="text-orange-600 font-medium">{fmtMoney(pendingTotal)}</span></div>
                </>
              )}
              <div className="border-t pt-3 flex justify-between font-bold text-gray-900">
                <span>Total</span><span className="text-lg">{fmtMoney(total)}</span>
              </div>
            </div>
          </div>

          {/* INFOS */}
          <div className="bg-white border rounded-xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Informations</h2>
            <div className="space-y-2.5 text-sm">
              <InfoRow label="Numéro" value={facture.number} />
              <InfoRow label="Type" value={docLabel} />
              <InfoRow label="Client" value={facture.clientName || "—"} />
              <InfoRow label="Date doc." value={fmtDate((facture.date ?? facture.createdAt) ?? null)} />
              {facture.devisNumber && <InfoRow label="Réf. devis" value={facture.devisNumber} />}
              {facture.abonnementTitre && <InfoRow label="Abonnement" value={facture.abonnementTitre} />}
              {company && <InfoRow label="Société" value={company.nom} />}
              <InfoRow label="Statut" value={STATUS_LABEL[facture.status]} />
              <InfoRow label="Lignes" value={`${items.length} prestation${items.length > 1 ? "s" : ""}`} />
              {echeances.length > 0 && <InfoRow label="Échéances" value={`${echeances.filter((e) => e.statut === "payé").length}/${echeances.length} payées`} />}
              {facture.signed && <InfoRow label="Signé le" value={fmtDate(facture.signedAt ?? null)} />}
            </div>
          </div>

          {/* GOOGLE AGENDA */}
          <div className="bg-white border rounded-xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Google Agenda</h2>
            <div className="space-y-2">
              <button
                onClick={() => gcalAdd(
                  `Envoi ${calNum(facture.number)} ${fmtMoney(total)} ${facture.clientName}`,
                  docDate,
                  `${docLabel} de ${fmtMoney(total)} pour ${facture.clientName}`
                )}
                className="flex items-center gap-2 w-full px-3 py-2.5 border rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                Ajouter envoi au calendrier
              </button>
              <button
                onClick={() => gcalAdd(
                  `Relance ${calNum(facture.number)} ${fmtMoney(total)} ${facture.clientName}`,
                  new Date(docDate.getTime() + 30 * 24 * 3600 * 1000),
                  `Relancer le client pour le règlement du ${docLabel.toLowerCase()} ${facture.number}`
                )}
                className="flex items-center gap-2 w-full px-3 py-2.5 border rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                <svg className="w-4 h-4 text-orange-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                Ajouter relance (J+30) au calendrier
              </button>
            </div>
          </div>

          {/* TÉLÉCHARGER + PARTAGER PDF */}
          <div className="space-y-2">
            <button onClick={handlePDF} disabled={generatingPdf} className="w-full flex items-center justify-center gap-2 py-3 bg-gray-800 hover:bg-gray-900 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              {generatingPdf ? "Génération…" : `Télécharger le ${docLabel.toLowerCase()} PDF`}
            </button>
            <button onClick={handleUploadAndShare} disabled={pdfUploading} className="w-full flex items-center justify-center gap-2 py-2.5 border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-60 rounded-xl text-sm font-medium transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              {pdfUploading ? "Upload en cours…" : "Stocker & Partager"}
            </button>
            {facture.pdfUrl && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-2">
                <p className="text-xs font-medium text-blue-700">Document en ligne — partager :</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const phone = (client?.telephone ?? "").replace(/\D/g, "");
                      const msg = encodeURIComponent(`Bonjour,\n\nVeuillez trouver votre ${docLabel.toLowerCase()} ${facture.number} ici :\n\n${facture.pdfUrl}\n\nCordialement`);
                      window.open(phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`, "_blank");
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    WhatsApp
                  </button>
                  <button
                    onClick={() => {
                      const email = client?.email ?? "";
                      const subject = encodeURIComponent(`${docLabel} ${facture.number}`);
                      const body = encodeURIComponent(`Bonjour,\n\nVeuillez trouver votre ${docLabel.toLowerCase()} ${facture.number} en cliquant sur le lien ci-dessous :\n\n${facture.pdfUrl}\n\nCordialement`);
                      window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_blank");
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    Email
                  </button>
                  <button
                    onClick={() => { navigator.clipboard.writeText(facture.pdfUrl!); showToast("Lien copié !"); }}
                    className="px-3 py-2 border rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition"
                    title="Copier le lien"
                  >
                    📋
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SIGNATURE */}
          {isDevis && facture.signed && facture.signatureUrl && (
            <div className="bg-white border rounded-xl shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-600 mb-2">Signature</p>
              <img src={facture.signatureUrl} alt="Signature" className="max-h-20 border rounded-lg bg-gray-50 p-1" />
              {facture.signedAt && <p className="text-xs text-gray-400 mt-1">Signé le {fmtDate(facture.signedAt)}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium text-right ml-2">{value}</span>
    </div>
  );
}

function SignaturePad({ onConfirm, onCancel }: { onConfirm: (dataUrl: string) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * sx, y: (t.clientY - rect.top) * sy };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * sx, y: ((e as React.MouseEvent).clientY - rect.top) * sy };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    setDrawing(true);
    lastPos.current = getPos(e, canvas);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !lastPos.current) return;
    e.preventDefault();
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    setHasStroke(true);
  };

  const endDraw = () => { setDrawing(false); lastPos.current = null; };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  };

  const importFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        setHasStroke(true);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-0.5">Signature du devis</h2>
        <p className="text-xs text-gray-500 mb-4">Dessinez ci-dessous ou importez une image de signature.</p>
        <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-gray-50 cursor-crosshair select-none">
          <canvas
            ref={canvasRef}
            width={600}
            height={180}
            className="w-full touch-none"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />
        </div>
        <div className="flex items-center gap-3 mt-2">
          <button onClick={clear} className="text-xs text-gray-400 hover:text-red-500 transition underline">Effacer</button>
          <label className="text-xs text-blue-600 hover:text-blue-800 transition underline cursor-pointer">
            Importer une image
            <input type="file" accept="image/*" className="hidden" onChange={importFile} />
          </label>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="flex-1 border rounded-lg py-2.5 text-sm text-gray-600 hover:bg-gray-100 transition">Annuler</button>
          <button
            onClick={() => { const c = canvasRef.current; if (c && hasStroke) onConfirm(c.toDataURL("image/png")); }}
            disabled={!hasStroke}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg py-2.5 text-sm font-semibold transition"
          >
            ✓ Confirmer la signature
          </button>
        </div>
      </div>
    </div>
  );
}
