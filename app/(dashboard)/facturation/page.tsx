"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useInvoices } from "@/hooks/useInvoices";
import { useCompanies } from "@/hooks/useCompanies";
import { useClients } from "@/hooks/useClients";
import type { Facture, FactureStatus, FactureType } from "@/types";

const STATUS_LABEL: Record<FactureStatus, string> = {
  draft: "Brouillon",
  sent: "En attente",
  paid: "Payée",
  overdue: "En retard",
  cancelled: "Annulée",
  accepted: "Accepté",
  rejected: "Non validé",
};

const STATUS_COLOR: Record<FactureStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-400",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-orange-100 text-orange-700",
};

function formatDate(ts: Facture["createdAt"]): string {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleDateString("fr-FR");
}

export default function FacturationPage() {
  const { currentUser } = useAuth();
  const { invoices, loading } = useInvoices(currentUser?.uid ?? "");
  const { companies } = useCompanies();
  const { clients } = useClients();

  const resolveClientName = (f: Facture): string => {
    const client = clients.find((c) => c.id === f.clientId);
    if (client) return [client.nom, client.prenom].filter(Boolean).join(" ");
    // fallback : stocker "undefined" → le nettoyer
    return (f.clientName ?? "").replace(/\bundefined\b/gi, "").replace(/\s+/g, " ").trim() || "—";
  };
  const searchParams = useSearchParams();
  const [docTab, setDocTab] = useState<FactureType>(() =>
    searchParams.get("tab") === "devis" ? "devis" : "facture"
  );
  const [filter, setFilter] = useState<FactureStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const router = useRouter();

  const factures = invoices.filter((f) => (f.type ?? "facture") === docTab);

  const visible = factures
    .filter((f) => filter === "all" || f.status === filter)
    .filter((f) => !filterCompany || f.companyId === filterCompany)
    .filter(
      (f) =>
        !search ||
        f.number?.toLowerCase().includes(search.toLowerCase()) ||
        resolveClientName(f).toLowerCase().includes(search.toLowerCase())
    );

  const paidFactures = invoices.filter((f) => f.status === "paid" && (f.type ?? "facture") === "facture");
  const ca = paidFactures.reduce((acc, f) => acc + (f.total ?? 0), 0);
  const pending = invoices.filter((f) => (f.status === "sent" || f.status === "overdue") && (f.type ?? "facture") === "facture").length;
  const overdue = invoices.filter((f) => f.status === "overdue" && (f.type ?? "facture") === "facture").length;
  const drafts = invoices.filter((f) => f.status === "draft").length;
  const devisCount = invoices.filter((f) => f.type === "devis").length;
  const devisSent = invoices.filter((f) => f.type === "devis" && f.status === "sent").length;

  const now = new Date();
  const getMonthCA = (offset: number) => {
    let m = now.getMonth() + offset;
    let y = now.getFullYear();
    while (m < 0) { m += 12; y--; }
    while (m > 11) { m -= 12; y++; }
    return paidFactures
      .filter((f) => { const ts = f.date ?? f.createdAt; if (!ts) return false; const d = new Date(ts.seconds * 1000); return d.getMonth() === m && d.getFullYear() === y; })
      .reduce((acc, f) => acc + (f.total ?? 0), 0);
  };
  const caM0 = getMonthCA(0);
  const caM1 = getMonthCA(-1);
  const caM2 = getMonthCA(-2);
  const caYear = paidFactures
    .filter((f) => { const ts = f.date ?? f.createdAt; if (!ts) return false; return new Date(ts.seconds * 1000).getFullYear() === now.getFullYear(); })
    .reduce((acc, f) => acc + (f.total ?? 0), 0);
  const monthTrend = caM1 > 0 ? Math.round(((caM0 - caM1) / caM1) * 100) : null;

  const MONTHS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const monthName = (offset: number) => { let m = now.getMonth() + offset; while (m < 0) m += 12; while (m > 11) m -= 12; return MONTHS_FR[m]; };

  return (
    <div className="min-h-screen">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Facturation</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gérez vos factures et paiements</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/facturation/bilan"
            className="border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap"
          >
            Bilan URSSAF
          </Link>
          <Link
            href={`/facturation/create${docTab === "devis" ? "?type=devis" : ""}`}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap"
          >
            {docTab === "devis" ? "+ Nouveau devis" : "+ Nouvelle facture"}
          </Link>
        </div>
      </div>

      {/* STATS */}
      <div className="space-y-3 mb-6">
        {/* Ligne 1 — CA */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="CA de l'année" value={`${caYear.toLocaleString("fr-FR")} €`} sub={String(now.getFullYear())} color="text-green-600" />
          <StatCard
            title={`CA ${monthName(0)}`}
            value={`${caM0.toLocaleString("fr-FR")} €`}
            sub="Ce mois"
            color="text-green-600"
            trend={monthTrend !== null ? monthTrend : undefined}
          />
          <StatCard title="CA total" value={`${ca.toLocaleString("fr-FR")} €`} sub="Toutes périodes payées" color="text-gray-900" />
          <StatCard title="En attente" value={String(pending)} sub="Envoyées / En retard" color="text-orange-600" />
        </div>
        {/* Ligne 2 — Documents */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Factures émises" value={String(invoices.filter((f) => (f.type ?? "facture") === "facture").length)} sub="Toutes statuts" color="text-gray-900" />
          <StatCard title="En retard" value={String(overdue)} sub="Paiement dépassé" color="text-red-600" />
          <StatCard title="Brouillons" value={String(drafts)} sub="Factures + devis" color="text-gray-400" />
          <StatCard title="Devis en attente" value={String(devisSent)} sub={`Sur ${devisCount} devis total`} color="text-purple-600" />
        </div>
        {/* Tendance CA — 3 derniers mois */}
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="text-xs font-medium text-gray-500 mb-3">Tendance CA — 3 derniers mois</div>
          <div className="grid grid-cols-3 gap-3">
            {([{ label: monthName(-2), ca: caM2, cur: false }, { label: monthName(-1), ca: caM1, cur: false }, { label: monthName(0), ca: caM0, cur: true }] as const).map(({ label, ca: mca, cur }, i, arr) => {
              const prev = i > 0 ? arr[i - 1].ca : null;
              const tpct = prev !== null && prev > 0 ? Math.round(((mca - prev) / prev) * 100) : null;
              return (
                <div key={i} className={`text-center px-3 py-3 rounded-lg ${cur ? "bg-blue-50 border border-blue-100" : "bg-gray-50"}`}>
                  <div className="text-xs text-gray-500 mb-1 font-medium">{label}</div>
                  <div className={`text-lg font-bold ${cur ? "text-blue-700" : "text-gray-700"}`}>{mca.toLocaleString("fr-FR")} €</div>
                  {tpct !== null && (
                    <div className={`text-xs font-medium mt-1 ${tpct > 0 ? "text-green-600" : tpct < 0 ? "text-red-500" : "text-gray-400"}`}>
                      {tpct > 0 ? "↑" : tpct < 0 ? "↓" : "="} {Math.abs(tpct)}% vs mois préc.
                    </div>
                  )}
                  {tpct === null && prev === 0 && i > 0 && (
                    <div className="text-xs text-gray-400 mt-1">—</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* TABLE CARD */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {/* TABS */}
        <div className="px-4 pt-3 border-b flex gap-1">
          {(["facture", "devis"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setDocTab(t); setFilter("all"); }}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition -mb-px border-b-2 ${
                docTab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "facture" ? "Factures" : `Devis (${devisCount})`}
            </button>
          ))}
        </div>

        {/* FILTERS */}
        <div className="px-4 py-3 border-b flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Rechercher par numéro ou client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 transition"
            />
            {companies.length > 1 && (
              <select
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                className={`border rounded-lg px-2.5 py-2 text-sm outline-none focus:border-blue-400 transition bg-white ${filterCompany ? "border-blue-400 text-blue-700 font-medium" : "text-gray-600"}`}
              >
                <option value="">Toutes sociétés</option>
                {companies.map((co) => <option key={co.id} value={co.id}>{co.nom}</option>)}
              </select>
            )}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(docTab === "devis"
              ? (["all", "draft", "sent", "accepted", "rejected", "cancelled"] as const)
              : (["all", "draft", "sent", "paid", "overdue", "cancelled"] as const)
            ).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  filter === s
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s === "all" ? "Toutes" : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        {/* COLUMN HEADERS — desktop only */}
        <div className="hidden sm:grid grid-cols-5 px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide border-b bg-gray-50">
          <span>Numéro</span>
          <span>Client</span>
          <span>Date</span>
          <span>Statut</span>
          <span className="text-right">Total</span>
        </div>

        {/* ROWS */}
        <div className="divide-y">
          {loading &&
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse px-4 py-4">
                {/* Mobile skeleton */}
                <div className="sm:hidden space-y-2">
                  <div className="flex justify-between">
                    <div className="h-4 bg-gray-100 rounded w-32" />
                    <div className="h-5 bg-gray-100 rounded w-16" />
                  </div>
                  <div className="h-3.5 bg-gray-100 rounded w-40" />
                  <div className="flex justify-between">
                    <div className="h-3.5 bg-gray-100 rounded w-20" />
                    <div className="h-4 bg-gray-100 rounded w-16" />
                  </div>
                </div>
                {/* Desktop skeleton */}
                <div className="hidden sm:grid grid-cols-5 gap-3">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div key={j} className={`h-4 bg-gray-100 rounded ${j === 4 ? "ml-auto w-16" : ""}`} />
                  ))}
                </div>
              </div>
            ))}

          {!loading && visible.length === 0 && (
            <div className="py-14 text-center">
              <p className="text-gray-400 text-sm">
                {factures.length === 0
                  ? `Aucun ${docTab === "devis" ? "devis" : "facture"} pour l'instant`
                  : "Aucun résultat"}
              </p>
              {factures.length === 0 && (
                <Link
                  href={`/facturation/create${docTab === "devis" ? "?type=devis" : ""}`}
                  className="mt-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition shadow-sm"
                >
                  <span className="text-base leading-none">+</span>
                  {docTab === "devis" ? "Créer votre premier devis" : "Créer votre première facture"}
                </Link>
              )}
            </div>
          )}

          {!loading &&
            visible.map((f) => (
              <div
                key={f.id}
                onClick={() => router.push(`/facturation/${f.id}`)}
                className="cursor-pointer hover:bg-gray-50 transition"
              >
                {/* Mobile card */}
                <div className="sm:hidden px-4 py-3.5">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900 leading-tight">{f.number}</span>
                    <StatusBadge status={f.status} />
                  </div>
                  <div className="text-sm text-gray-600 truncate mb-2">{resolveClientName(f)}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{formatDate(f.date ?? f.createdAt)}</span>
                    <div className="flex items-center gap-2">
                      {f.pdfUrl && (
                        <a
                          href={f.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="Télécharger le PDF"
                          className="text-gray-400 hover:text-blue-600 transition"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6M9 16h4" />
                          </svg>
                        </a>
                      )}
                      <span className="text-sm font-semibold text-gray-900">
                        {(f.total ?? 0).toLocaleString("fr-FR")} €
                      </span>
                    </div>
                  </div>
                </div>

                {/* Desktop row */}
                <div className="hidden sm:grid grid-cols-5 px-4 py-3.5 items-center">
                  <span className="text-sm font-semibold text-gray-900">{f.number}</span>
                  <span className="text-sm text-gray-600 truncate">{resolveClientName(f)}</span>
                  <span className="text-sm text-gray-500">{formatDate(f.date ?? f.createdAt)}</span>
                  <StatusBadge status={f.status} />
                  <div className="flex items-center justify-end gap-2">
                    {f.pdfUrl && (
                      <a
                        href={f.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Télécharger le PDF"
                        className="text-gray-400 hover:text-blue-600 transition shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6M9 16h4" />
                        </svg>
                      </a>
                    )}
                    <span className="text-sm font-semibold text-gray-900">
                      {(f.total ?? 0).toLocaleString("fr-FR")} €
                    </span>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
  color,
  trend,
}: {
  title: string;
  value: string;
  sub: string;
  color: string;
  trend?: number;
}) {
  return (
    <div className="bg-white p-4 rounded-xl border shadow-sm">
      <div className="text-xs text-gray-500 mb-1">{title}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="flex items-center gap-1.5 mt-1">
        <span className="text-xs text-gray-400">{sub}</span>
        {trend !== undefined && (
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${trend > 0 ? "bg-green-50 text-green-600" : trend < 0 ? "bg-red-50 text-red-500" : "bg-gray-100 text-gray-400"}`}>
            {trend > 0 ? "↑" : trend < 0 ? "↓" : "="}{Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: FactureStatus }) {
  return (
    <span className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${STATUS_COLOR[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
