"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useStoreApps } from "@/hooks/useStoreApps";
import { useStoreSubscriptions } from "@/hooks/useStoreSubscriptions";
import { useClients } from "@/hooks/useClients";
import { useUsers } from "@/hooks/useUsers";
import {
  createStoreApp, updateStoreApp, deleteStoreApp,
  createStoreSubscription, updateStoreSubscription, deleteStoreSubscription,
} from "@/lib/storeService";
import { Timestamp } from "firebase/firestore";
import type { StoreApp, StoreSubscription, StoreSubStatut } from "@/types";

const STATUT_LABEL: Record<StoreSubStatut, string> = {
  active: "Actif",
  pending: "En attente",
  suspended: "Suspendu",
  cancelled: "Annulé",
};

const STATUT_COLOR: Record<StoreSubStatut, string> = {
  active: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  suspended: "bg-red-100 text-red-600",
  cancelled: "bg-gray-100 text-gray-500",
};

const PERIOD_LABEL: Record<StoreApp["periodicite"], string> = {
  mensuel: "/mois",
  annuel: "/an",
  unique: "unique",
};

const COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];
const EMOJIS = ["🃏", "📊", "🏃", "💪", "🧠", "🎯", "📅", "⚡", "🔥", "🏆", "📱", "🎮", "🧘", "🚴"];

function toDateStr(ts?: { seconds: number } | null) {
  if (!ts) return "";
  return new Date(ts.seconds * 1000).toLocaleDateString("fr-FR");
}

function toInput(ts?: { seconds: number } | null) {
  if (!ts) return "";
  return new Date(ts.seconds * 1000).toISOString().split("T")[0];
}

export default function BoutiqueAdminPage() {
  const router = useRouter();
  const { currentUser, userProfile } = useAuth();
  const isAdmin = userProfile?.role_app === "Admin";
  const { apps, loading: loadingApps } = useStoreApps();
  const { subscriptions, loading: loadingSubs } = useStoreSubscriptions();
  const { clients } = useClients();
  const { users } = useUsers();

  const [tab, setTab] = useState<"apps" | "subs">("apps");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // ── App modal state ───────────────────────────────────────────────────────
  const [showAppModal, setShowAppModal] = useState(false);
  const [editApp, setEditApp] = useState<StoreApp | null>(null);
  const [appForm, setAppForm] = useState({
    nom: "", shortDesc: "", description: "", icon: "🎯", couleur: "#6366f1",
    prix: "", periodicite: "mensuel" as StoreApp["periodicite"], actif: true, ordre: "0", route: "", tags: "",
  });
  const [savingApp, setSavingApp] = useState(false);

  // ── Sub modal state ───────────────────────────────────────────────────────
  const [showSubModal, setShowSubModal] = useState(false);
  const [editSub, setEditSub] = useState<StoreSubscription | null>(null);
  const [subForm, setSubForm] = useState({
    appId: "", clientId: "", clientNom: "", clientEmail: "", userUid: "",
    statut: "active" as StoreSubStatut, dateDebut: new Date().toISOString().split("T")[0],
    dateFin: "", notes: "",
  });
  const [savingSub, setSavingSub] = useState(false);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filterApp, setFilterApp] = useState("");
  const [filterStatut, setFilterStatut] = useState<StoreSubStatut | "all">("all");
  const [searchSub, setSearchSub] = useState("");
  const [clientSubSearch, setClientSubSearch] = useState("");

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-sm">Accès réservé aux administrateurs.</p>
      </div>
    );
  }

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // ── App CRUD ──────────────────────────────────────────────────────────────
  const openNewApp = () => {
    setEditApp(null);
    setAppForm({ nom: "", shortDesc: "", description: "", icon: "🎯", couleur: "#6366f1", prix: "", periodicite: "mensuel", actif: true, ordre: String(apps.length), route: "", tags: "" });
    setShowAppModal(true);
  };

  const openEditApp = (app: StoreApp) => {
    setEditApp(app);
    setAppForm({
      nom: app.nom, shortDesc: app.shortDesc, description: app.description,
      icon: app.icon, couleur: app.couleur, prix: String(app.prix),
      periodicite: app.periodicite, actif: app.actif, ordre: String(app.ordre),
      route: app.route ?? "", tags: (app.tags ?? []).join(", "),
    });
    setShowAppModal(true);
  };

  const saveApp = async () => {
    if (!appForm.nom.trim()) return;
    setSavingApp(true);
    try {
      const rawData = {
        nom: appForm.nom.trim(),
        shortDesc: appForm.shortDesc.trim(),
        description: appForm.description.trim(),
        icon: appForm.icon,
        couleur: appForm.couleur,
        prix: Number(appForm.prix) || 0,
        periodicite: appForm.periodicite,
        actif: appForm.actif,
        ordre: Number(appForm.ordre) || 0,
        route: appForm.route.trim() || null,
        tags: appForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
        createdBy: currentUser!.uid,
      };
      const data = Object.fromEntries(Object.entries(rawData).filter(([, v]) => v !== undefined)) as typeof rawData;
      if (editApp) {
        await updateStoreApp(editApp.id, data);
        showToast("Application modifiée.");
      } else {
        await createStoreApp(data as Omit<StoreApp, "id" | "createdAt">);
        showToast("Application créée.");
      }
      setShowAppModal(false);
    } catch (e) {
      console.error("[saveApp]", e);
      showToast("Erreur lors de l'enregistrement.", false);
    } finally {
      setSavingApp(false);
    }
  };

  const handleDeleteApp = async (app: StoreApp) => {
    if (!confirm(`Supprimer "${app.nom}" ? Les abonnements associés resteront en base.`)) return;
    await deleteStoreApp(app.id);
    showToast("Application supprimée.");
  };

  // ── Sub CRUD ──────────────────────────────────────────────────────────────
  const openNewSub = () => {
    setEditSub(null);
    setSubForm({ appId: apps[0]?.id ?? "", clientId: "", clientNom: "", clientEmail: "", userUid: "", statut: "active", dateDebut: new Date().toISOString().split("T")[0], dateFin: "", notes: "" });
    setShowSubModal(true);
  };

  const openEditSub = (sub: StoreSubscription) => {
    setEditSub(sub);
    setSubForm({
      appId: sub.appId, clientId: sub.clientId ?? "", clientNom: sub.clientNom,
      clientEmail: sub.clientEmail ?? "", userUid: sub.userUid ?? "",
      statut: sub.statut, dateDebut: toInput(sub.dateDebut),
      dateFin: toInput(sub.dateFin), notes: sub.notes ?? "",
    });
    setShowSubModal(true);
  };

  const handleSelectClient = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    const linkedUser = client?.linkedUserId ? users.find((u) => u.uid === client.linkedUserId) : null;
    setSubForm((f) => ({
      ...f,
      clientId,
      clientNom: client ? [client.nom, client.prenom].filter(Boolean).join(" ") : "",
      clientEmail: client?.email ?? "",
      userUid: linkedUser?.uid ?? "",
    }));
  };

  const saveSub = async () => {
    if (!subForm.appId || !subForm.clientNom.trim()) return;
    setSavingSub(true);
    try {
      const app = apps.find((a) => a.id === subForm.appId);
      const rawSub = {
        appId: subForm.appId,
        appNom: app?.nom ?? "",
        clientId: subForm.clientId || null,
        clientNom: subForm.clientNom.trim(),
        clientEmail: subForm.clientEmail.trim() || null,
        userUid: subForm.userUid.trim() || null,
        statut: subForm.statut,
        dateDebut: subForm.dateDebut ? Timestamp.fromDate(new Date(subForm.dateDebut)) : Timestamp.now(),
        dateFin: subForm.dateFin ? Timestamp.fromDate(new Date(subForm.dateFin)) : null,
        notes: subForm.notes.trim() || null,
        createdBy: currentUser!.uid,
      };
      const data = Object.fromEntries(
        Object.entries(rawSub).filter(([, v]) => v !== undefined)
      ) as Omit<StoreSubscription, "id" | "createdAt">;
      if (editSub) {
        await updateStoreSubscription(editSub.id, data);
        showToast("Abonnement modifié.");
      } else {
        await createStoreSubscription(data);
        showToast("Abonnement créé.");
      }
      setShowSubModal(false);
    } catch (e) {
      console.error("[saveSub]", e);
      showToast("Erreur lors de l'enregistrement.", false);
    } finally {
      setSavingSub(false);
    }
  };

  const quickSetStatut = async (sub: StoreSubscription, statut: StoreSubStatut) => {
    await updateStoreSubscription(sub.id, { statut });
    showToast(`Statut → ${STATUT_LABEL[statut]}`);
  };

  const handleDeleteSub = async (sub: StoreSubscription) => {
    if (!confirm(`Supprimer l'abonnement de ${sub.clientNom} ?`)) return;
    await deleteStoreSubscription(sub.id);
    showToast("Abonnement supprimé.");
  };

  const handleFacturer = (sub: StoreSubscription) => {
    const app = apps.find((a) => a.id === sub.appId);
    const params = new URLSearchParams();
    if (sub.clientId) params.set("clientId", sub.clientId);
    if (app) params.set("label", app.nom);
    if (app) params.set("prix", String(app.prix));
    router.push(`/facturation/create?${params.toString()}`);
  };

  const filteredSubs = subscriptions
    .filter((s) => !filterApp || s.appId === filterApp)
    .filter((s) => filterStatut === "all" || s.statut === filterStatut)
    .filter((s) => !searchSub || s.clientNom.toLowerCase().includes(searchSub.toLowerCase()) || s.clientEmail?.toLowerCase().includes(searchSub.toLowerCase()));

  return (
    <div className="min-h-screen">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[200] px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition ${toast.ok ? "bg-green-500" : "bg-red-500"}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push("/boutique")} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-500 transition">←</button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Gestion du Store</h1>
          <p className="text-sm text-gray-500">Applications et abonnements</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {(["apps", "subs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          >
            {t === "apps" ? `Applications (${apps.length})` : `Abonnements (${subscriptions.length})`}
          </button>
        ))}
      </div>

      {/* ── APPS TAB ─────────────────────────────────────────────────────────── */}
      {tab === "apps" && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={openNewApp} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition">
              + Nouvelle application
            </button>
          </div>
          {loadingApps ? (
            <div className="text-center py-10 text-gray-400 text-sm">Chargement…</div>
          ) : apps.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-3xl mb-2">🏪</p>
              <p className="text-sm">Aucune application. Créez la première !</p>
            </div>
          ) : (
            <div className="space-y-3">
              {apps.map((app) => {
                const subCount = subscriptions.filter((s) => s.appId === app.id && s.statut === "active").length;
                return (
                  <div key={app.id} className="bg-white border rounded-xl p-4 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: app.couleur + "20" }}>
                      {app.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">{app.nom}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${app.actif ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {app.actif ? "Actif" : "Inactif"}
                        </span>
                        <span className="text-xs text-gray-400">{subCount} abonné{subCount > 1 ? "s" : ""}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{app.shortDesc}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold text-gray-900">{app.prix === 0 ? "Gratuit" : `${app.prix} €${PERIOD_LABEL[app.periodicite]}`}</div>
                      {app.route && <div className="text-xs text-blue-500 truncate max-w-[120px]">{app.route}</div>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => openEditApp(app)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition" title="Modifier">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button onClick={() => handleDeleteApp(app)} className="p-2 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition" title="Supprimer">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SUBS TAB ─────────────────────────────────────────────────────────── */}
      {tab === "subs" && (
        <div>
          {/* Filters + Add */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              type="text" placeholder="Rechercher un client…"
              value={searchSub} onChange={(e) => setSearchSub(e.target.value)}
              className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 transition"
            />
            <select value={filterApp} onChange={(e) => setFilterApp(e.target.value)} className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white text-gray-600">
              <option value="">Toutes les apps</option>
              {apps.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.nom}</option>)}
            </select>
            <select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value as StoreSubStatut | "all")} className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white text-gray-600">
              <option value="all">Tous statuts</option>
              {(Object.keys(STATUT_LABEL) as StoreSubStatut[]).map((s) => (
                <option key={s} value={s}>{STATUT_LABEL[s]}</option>
              ))}
            </select>
            <button onClick={openNewSub} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap shrink-0">
              + Nouvel abonnement
            </button>
          </div>

          {loadingSubs ? (
            <div className="text-center py-10 text-gray-400 text-sm">Chargement…</div>
          ) : filteredSubs.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-3xl mb-2">📋</p>
              <p className="text-sm">{subscriptions.length === 0 ? "Aucun abonnement pour l'instant." : "Aucun résultat."}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSubs.map((sub) => {
                const app = apps.find((a) => a.id === sub.appId);
                return (
                  <div key={sub.id} className="bg-white border rounded-xl p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      {/* App icon */}
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: (app?.couleur ?? "#6366f1") + "20" }}>
                        {app?.icon ?? "📦"}
                      </div>
                      {/* Client info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-gray-900">{sub.clientNom}</span>
                          <span className="text-xs text-gray-400">·</span>
                          <span className="text-xs text-gray-500">{sub.appNom}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_COLOR[sub.statut]}`}>{STATUT_LABEL[sub.statut]}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          Depuis {toDateStr(sub.dateDebut)}
                          {sub.dateFin ? ` → ${toDateStr(sub.dateFin)}` : ""}
                          {sub.clientEmail ? ` · ${sub.clientEmail}` : ""}
                        </div>
                        {sub.factureNumber && (
                          <div className="text-xs text-blue-500 mt-0.5">Facture : {sub.factureNumber}</div>
                        )}
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                        {/* Quick statut */}
                        {sub.statut !== "active" && (
                          <button onClick={() => quickSetStatut(sub, "active")} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition">Activer</button>
                        )}
                        {sub.statut === "active" && (
                          <button onClick={() => quickSetStatut(sub, "suspended")} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition">Suspendre</button>
                        )}
                        {sub.statut !== "cancelled" && (
                          <button onClick={() => quickSetStatut(sub, "cancelled")} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-500 hover:bg-gray-200 transition">Annuler</button>
                        )}
                        {/* Facturer */}
                        <button onClick={() => handleFacturer(sub)} title="Créer une facture" className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        </button>
                        {/* Edit */}
                        <button onClick={() => openEditSub(sub)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        {/* Delete */}
                        <button onClick={() => handleDeleteSub(sub)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                    {sub.notes && <p className="text-xs text-gray-400 mt-2 italic">{sub.notes}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── APP MODAL ─────────────────────────────────────────────────────────── */}
      {showAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowAppModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{editApp ? "Modifier l'application" : "Nouvelle application"}</h2>
              <button onClick={() => setShowAppModal(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {/* Icône + couleur */}
              <div className="flex gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Icône</label>
                  <div className="flex flex-wrap gap-1.5">
                    {EMOJIS.map((e) => (
                      <button key={e} type="button" onClick={() => setAppForm((f) => ({ ...f, icon: e }))}
                        className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition ${appForm.icon === e ? "bg-blue-100 ring-2 ring-blue-400" : "hover:bg-gray-100"}`}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Couleur</label>
                  <div className="flex flex-wrap gap-1.5">
                    {COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => setAppForm((f) => ({ ...f, couleur: c }))}
                        className={`w-7 h-7 rounded-full transition ${appForm.couleur === c ? "ring-2 ring-offset-1 ring-gray-700" : ""}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>
              {/* Aperçu */}
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: appForm.couleur + "15" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: appForm.couleur + "30" }}>{appForm.icon}</div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">{appForm.nom || "Nom de l'application"}</div>
                  <div className="text-xs text-gray-500">{appForm.shortDesc || "Description courte"}</div>
                </div>
              </div>
              {/* Champs */}
              {[
                { label: "Nom *", key: "nom", placeholder: "Ex : Compteur de belote" },
                { label: "Accroche courte *", key: "shortDesc", placeholder: "Ex : Calculez les points de vos parties" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input type="text" placeholder={placeholder} value={(appForm as any)[key]}
                    onChange={(e) => setAppForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description complète</label>
                <textarea rows={3} placeholder="Description détaillée de l'application…" value={appForm.description}
                  onChange={(e) => setAppForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Prix (€)</label>
                  <input type="number" min="0" step="0.01" placeholder="0" value={appForm.prix}
                    onChange={(e) => setAppForm((f) => ({ ...f, prix: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Périodicité</label>
                  <select value={appForm.periodicite} onChange={(e) => setAppForm((f) => ({ ...f, periodicite: e.target.value as StoreApp["periodicite"] }))}
                    className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition bg-white">
                    <option value="mensuel">Mensuel</option>
                    <option value="annuel">Annuel</option>
                    <option value="unique">Paiement unique</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Route interne</label>
                  <input type="text" placeholder="/boutique/belote" value={appForm.route}
                    onChange={(e) => setAppForm((f) => ({ ...f, route: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ordre d'affichage</label>
                  <input type="number" min="0" value={appForm.ordre}
                    onChange={(e) => setAppForm((f) => ({ ...f, ordre: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tags (séparés par virgule)</label>
                <input type="text" placeholder="Jeux, Calcul, Sport…" value={appForm.tags}
                  onChange={(e) => setAppForm((f) => ({ ...f, tags: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition" />
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setAppForm((f) => ({ ...f, actif: !f.actif }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${appForm.actif ? "bg-green-500" : "bg-gray-200"}`}>
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${appForm.actif ? "translate-x-4.5" : "translate-x-0.5"}`} />
                </button>
                <span className="text-sm text-gray-700">Application active (visible dans la boutique)</span>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3">
              <button onClick={() => setShowAppModal(false)} className="flex-1 border rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">Annuler</button>
              <button onClick={saveApp} disabled={savingApp || !appForm.nom.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold transition">
                {savingApp ? "Enregistrement…" : editApp ? "Enregistrer" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SUB MODAL ─────────────────────────────────────────────────────────── */}
      {showSubModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowSubModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{editSub ? "Modifier l'abonnement" : "Nouvel abonnement"}</h2>
              <button onClick={() => setShowSubModal(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Application *</label>
                <select value={subForm.appId} onChange={(e) => setSubForm((f) => ({ ...f, appId: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 bg-white">
                  {apps.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Client (depuis la liste)</label>
                {subForm.clientId ? (
                  <div className="flex items-center justify-between border border-blue-300 bg-blue-50 rounded-lg px-3 py-2.5">
                    <span className="text-sm font-medium text-blue-800">{subForm.clientNom}</span>
                    <button type="button" onClick={() => { handleSelectClient(""); setClientSubSearch(""); }}
                      className="text-blue-400 hover:text-red-500 text-xs ml-2 transition">Changer</button>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <input
                      type="text"
                      placeholder="Rechercher par nom, prénom ou email…"
                      value={clientSubSearch}
                      onChange={(e) => setClientSubSearch(e.target.value)}
                      className="w-full px-3 py-2 text-sm outline-none border-b focus:border-blue-400"
                    />
                    <div className="max-h-44 overflow-y-auto">
                      <button type="button" onClick={() => handleSelectClient("")}
                        className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 border-b transition italic">
                        — Saisie manuelle —
                      </button>
                      {[...clients]
                        .sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, "fr"))
                        .filter((c) => {
                          const q = clientSubSearch.toLowerCase();
                          return !q || c.nom.toLowerCase().includes(q) || (c.prenom ?? "").toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q);
                        })
                        .map((c) => (
                          <button type="button" key={c.id}
                            onClick={() => { handleSelectClient(c.id); setClientSubSearch(""); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0 transition">
                            <span className="font-medium text-gray-800">{[c.nom, c.prenom].filter(Boolean).join(" ")}</span>
                            {c.email && <span className="text-xs text-gray-400 ml-2">{c.email}</span>}
                          </button>
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>
              {!subForm.clientId && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nom *</label>
                    <input type="text" placeholder="Prénom Nom" value={subForm.clientNom}
                      onChange={(e) => setSubForm((f) => ({ ...f, clientNom: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                    <input type="email" placeholder="email@…" value={subForm.clientEmail}
                      onChange={(e) => setSubForm((f) => ({ ...f, clientEmail: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition" />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Statut</label>
                <select value={subForm.statut} onChange={(e) => setSubForm((f) => ({ ...f, statut: e.target.value as StoreSubStatut }))}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 bg-white">
                  {(Object.keys(STATUT_LABEL) as StoreSubStatut[]).map((s) => (
                    <option key={s} value={s}>{STATUT_LABEL[s]}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date de début</label>
                  <input type="date" value={subForm.dateDebut}
                    onChange={(e) => setSubForm((f) => ({ ...f, dateDebut: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date de fin</label>
                  <input type="date" value={subForm.dateFin}
                    onChange={(e) => setSubForm((f) => ({ ...f, dateFin: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes internes</label>
                <textarea rows={2} placeholder="Remarques, conditions particulières…" value={subForm.notes}
                  onChange={(e) => setSubForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3">
              <button onClick={() => setShowSubModal(false)} className="flex-1 border rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">Annuler</button>
              <button onClick={saveSub} disabled={savingSub || !subForm.appId || !subForm.clientNom.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold transition">
                {savingSub ? "Enregistrement…" : editSub ? "Enregistrer" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
