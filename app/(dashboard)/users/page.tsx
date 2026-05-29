"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUsers } from "@/hooks/useUsers";
import { useClients } from "@/hooks/useClients";
import { updateUser } from "@/lib/userService";
import { uploadImage } from "@/lib/uploadImage";
import { createClient } from "@/lib/clientService";
import { createAbonnement } from "@/lib/abonnementService";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, Timestamp } from "firebase/firestore";
import { UsersIcon } from "@heroicons/react/24/outline";
import AdresseAutocomplete from "@/components/ui/AdresseAutocomplete";
import SuggestInput from "@/components/ui/SuggestInput";
import { PhoneInput } from "@/components/ui/PhoneInput";
import type { User, AbonnementEtat } from "@/types";

const PROFESSIONS = [
  "Agriculteur", "Architecte", "Assistant maternel", "Auxiliaire de vie",
  "Avocat", "Cadre dirigeant", "Chef cuisinier", "Chef d'entreprise",
  "Chercheur", "Chômeur", "Chirurgien", "Comptable", "Consultant",
  "Dentiste", "Designer", "Développeur", "Directeur commercial",
  "Éducateur sportif", "Électricien", "Enseignant", "Entrepreneur",
  "Étudiant", "Formateur", "Graphiste", "Infirmier", "Ingénieur",
  "Journaliste", "Juriste", "Kinésithérapeute", "Logisticien",
  "Manager", "Médecin", "Militaire", "Ostéopathe", "Pharmacien",
  "Photographe", "Plombier", "Police / Gendarmerie", "Pompier",
  "Professeur", "Psychologue", "Retraité", "Sans emploi",
  "Technicien", "Traducteur", "Vétérinaire",
]

const VALID_ETATS: AbonnementEtat[] = ["Actif", "Inactif", "En attente", "Terminé", "Suspendu"];

const toUpperName = (s: string) => s.toUpperCase()
const toProperName = (s: string) =>
  s.split(/([\s-])/).map(p => /[\s-]/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('')

const inputCls = "w-full min-w-0 border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition";

type UserForm = {
  nom: string; prenom: string; indicatif_tel: string; phone_number: string; photo_url: string;
  genre: string; date_naissance: string; profession: string;
  adresse_postale: string; rue_adresse: string; ville_adresse: string; code_postale_adresse: string;
};

export default function UsersPage() {
  const router = useRouter();
  const { currentUser, userProfile } = useAuth();
  const { users, loading } = useUsers();
  const { clients } = useClients();
  const isAdmin = userProfile?.role_app === "Admin";

  useEffect(() => {
    if (userProfile && !isAdmin) router.replace("/accueil");
  }, [userProfile, isAdmin, router]);

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | "Admin" | "Utilisateur">("all");
  const [filterImport, setFilterImport] = useState<"all" | "non_importes">("all");

  // Set des linkedUserId pour savoir quels users sont déjà importés comme client
  const linkedIds = new Set(clients.map((c) => c.linkedUserId).filter(Boolean));

  const visible = users
    .filter((u) => {
      const q = search.toLowerCase();
      const matchSearch = !q || u.nom?.toLowerCase().includes(q) || u.prenom?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
      const matchRole = filterRole === "all" || u.role_app === filterRole;
      const matchImport = filterImport === "all" || !linkedIds.has(u.id);
      return matchSearch && matchRole && matchImport;
    })
    .sort((a, b) => {
      const nomCmp = (a.nom ?? '').localeCompare(b.nom ?? '', 'fr', { sensitivity: 'base' });
      if (nomCmp !== 0) return nomCmp;
      return (a.prenom ?? '').localeCompare(b.prenom ?? '', 'fr', { sensitivity: 'base' });
    });

  // ── Modal édition utilisateur ─────────────────────────────
  const [editModal, setEditModal] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });
  const emptyEditForm: UserForm = { nom: "", prenom: "", indicatif_tel: "+33", phone_number: "", photo_url: "", genre: "", date_naissance: "", profession: "", adresse_postale: "", rue_adresse: "", ville_adresse: "", code_postale_adresse: "" };
  const [editForm, setEditForm] = useState<UserForm>(emptyEditForm);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const openEdit = (u: User) => {
    const uu = u as any;
    const dnDate = uu.date_naissance?.toDate?.();
    setEditForm({
      nom: u.nom ?? "",
      prenom: u.prenom ?? "",
      indicatif_tel: (u as any).indicatif_tel || "+33",
      phone_number: u.phone_number ?? "",
      photo_url: u.photo_url ?? "",
      genre: uu.genre ?? "",
      date_naissance: dnDate ? `${dnDate.getFullYear()}-${String(dnDate.getMonth()+1).padStart(2,'0')}-${String(dnDate.getDate()).padStart(2,'0')}` : "",
      profession: uu.profession ?? "",
      adresse_postale: uu.adresse_postale ?? "",
      rue_adresse: uu.rue_adresse ?? "",
      ville_adresse: uu.ville_adresse ?? "",
      code_postale_adresse: uu.code_postale_adresse ?? "",
    });
    setEditError("");
    setEditModal({ open: true, user: u });
  };

  const handlePhotoUpload = async (file: File, userId: string) => {
    setUploadingPhoto(true);
    try {
      const url = await uploadImage(file, `avatars/${userId}/${Date.now()}_${file.name}`);
      setEditForm((f) => ({ ...f, photo_url: url }));
    } catch {
      setEditError("Erreur lors de l'upload de la photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const submitEdit = async () => {
    if (!editModal.user) return;
    if (!editForm.nom.trim() || !editForm.prenom.trim()) return setEditError("Nom et prénom requis.");
    setEditSaving(true);
    try {
      const dnTs = editForm.date_naissance ? new Date(editForm.date_naissance + 'T00:00:00') : null;
      await updateUser(editModal.user.id, {
        nom: editForm.nom.trim(),
        prenom: editForm.prenom.trim(),
        display_name: `${editForm.prenom.trim()} ${editForm.nom.trim()}`,
        indicatif_tel: editForm.indicatif_tel || '+33',
        phone_number: editForm.phone_number.trim() || undefined,
        photo_url: editForm.photo_url || undefined,
        genre: editForm.genre || undefined,
        date_naissance: dnTs,
        profession: editForm.profession.trim() || undefined,
        adresse_postale: editForm.adresse_postale.trim() || undefined,
        rue_adresse: editForm.rue_adresse.trim() || undefined,
        ville_adresse: editForm.ville_adresse.trim() || undefined,
        code_postale_adresse: editForm.code_postale_adresse.trim() || undefined,
      });
      setEditModal({ open: false, user: null });
    } catch {
      setEditError("Erreur lors de la modification.");
    } finally {
      setEditSaving(false);
    }
  };

  // ── Toast ─────────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Impersonation ─────────────────────────────────────────
  const [impersonating, setImpersonating] = useState<string | null>(null);

  const handleImpersonate = async (u: User) => {
    setImpersonating(u.id);
    try {
      const adminToken = await auth.currentUser!.getIdToken();
      const res = await fetch('/api/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminToken, targetUid: u.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur serveur');
      const adminName = `${userProfile?.prenom ?? ''} ${userProfile?.nom ?? ''}`.trim();
      const targetName = `${u.prenom ?? ''} ${u.nom ?? ''}`.trim();
      router.push(
        `/impersonate?token=${encodeURIComponent(data.customToken)}&adminName=${encodeURIComponent(adminName)}&targetName=${encodeURIComponent(targetName)}`
      );
    } catch (err: any) {
      showToast(err.message ?? "Erreur lors de l'impersonation", false);
      setImpersonating(null);
    }
  };

  // ── Import rapide comme client ────────────────────────────
  const [importing, setImporting] = useState<string | null>(null);

  const importAsClient = async (u: User) => {
    setImporting(u.id);
    try {
      const uu = u as any;
      const { id: clientId } = await createClient({
        userId: currentUser!.uid,
        prenom: u.prenom ?? "",
        nom: u.nom ?? "",
        email: u.email || undefined,
        telephone: u.phone_number || undefined,
        indicatif_tel: (u as any).indicatif_tel || undefined,
        genre: uu.genre?.trim() || undefined,
        adresse: uu.rue_adresse?.trim() || undefined,
        ville: uu.ville_adresse?.trim() || undefined,
        codePostal: uu.code_postale_adresse?.trim() || undefined,
        profession: uu.profession?.trim() || undefined,
        dateNaissance: uu.date_naissance || undefined,
        linkedUserId: u.id,
        actif: true,
      });

      // Migrate existing database_users_details → abonnements
      const userRef = doc(db, "users", u.id);
      const detailsSnap = await getDocs(
        query(collection(db, "database_users_details"), where("refUsers", "==", userRef))
      );
      await Promise.all(
        detailsSnap.docs.map((d) => {
          const detail = d.data();
          return createAbonnement({
            userId: currentUser!.uid,
            clientId,
            titre: detail.titre_abo || detail.categorie_prestation || "",
            categorie: detail.categorie_prestation || "",
            typeSuivi: detail.type_suivi || "",
            resumeSuivi: detail.resume_suivi || undefined,
            objectifs: detail.objectifs || undefined,
            dateDebut: detail.date_debut,
            dateFin: detail.date_fin,
            indications: detail.indications || undefined,
            etat: (VALID_ETATS.includes(detail.etat) ? detail.etat : "Actif") as AbonnementEtat,
          });
        })
      );

      const count = detailsSnap.size;
      showToast(`${[u.nom, u.prenom].filter(Boolean).join(" ")} importé${count > 0 ? ` · ${count} abonnement${count > 1 ? "s" : ""} migré${count > 1 ? "s" : ""}` : ""}`);
    } catch (e) {
      console.error("[importAsClient]", e);
      showToast("Erreur lors de l'import", false);
    } finally {
      setImporting(null);
    }
  };

  if (!userProfile || !isAdmin) return null;

  return (
    <div className="min-h-screen">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${toast.ok ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.msg}
        </div>
      )}

      {/* HEADER */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Utilisateurs</h1>
            <p className="text-sm text-gray-500 mt-0.5">{users.length} compte{users.length !== 1 ? "s" : ""} · utilisateurs de l'application</p>
          </div>
          <button
            onClick={() => router.push("/clients")}
            className="flex items-center gap-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-2 rounded-lg transition"
          >
            <UsersIcon className="w-4 h-4" />
            Clients
          </button>
        </div>

        {/* Bannière info */}
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
          <strong>Comment ça marche :</strong> Les utilisateurs ci-dessous ont un compte dans l'application. Cliquez sur <strong>"Importer comme client"</strong> pour créer une fiche client de facturation à partir de leur profil.
        </div>
      </div>

      {/* FILTRES */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Rechercher par nom, prénom ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 sm:max-w-xs border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition bg-white"
        />
        <div className="flex flex-wrap gap-1.5">
          {(["all", "Admin", "Utilisateur"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition ${filterRole === r ? "bg-blue-600 text-white" : "bg-white border text-gray-600 hover:bg-gray-50"}`}
            >
              {r === "all" ? "Tous" : r}
            </button>
          ))}
          <button
            onClick={() => setFilterImport(filterImport === "non_importes" ? "all" : "non_importes")}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition ${filterImport === "non_importes" ? "bg-orange-500 text-white" : "bg-white border text-gray-600 hover:bg-gray-50"}`}
          >
            Non importés
          </button>
        </div>
      </div>

      {/* LISTE */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-5 py-4 flex gap-4 animate-pulse border-b">
            <div className="w-10 h-10 rounded-full bg-gray-100 shrink-0" />
            <div className="flex-1 space-y-2 py-0.5"><div className="h-4 bg-gray-100 rounded w-1/3" /><div className="h-3 bg-gray-100 rounded w-1/4" /></div>
          </div>
        ))}

        {!loading && visible.length === 0 && (
          <div className="py-14 text-center"><p className="text-gray-400 text-sm">Aucun résultat</p></div>
        )}

        {!loading && visible.map((u) => {
          const isMe = u.id === currentUser?.uid;
          const alreadyClient = linkedIds.has(u.id);
          const initials = ((u.prenom?.[0] ?? "") + (u.nom?.[0] ?? "")).toUpperCase() || "?";

          return (
            <div key={u.id} className="px-4 py-4 border-b last:border-0 hover:bg-gray-50 transition">
              {/* Ligne info */}
              <div className="flex items-start gap-3">
                {/* Avatar */}
                {u.photo_url ? (
                  <img src={u.photo_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0 border border-gray-200" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-sm shrink-0">
                    {initials}
                  </div>
                )}

                {/* Texte */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-sm text-gray-900">{u.nom} {u.prenom}</span>
                    {isMe && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">Moi</span>}
                    {u.role_app && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${u.role_app === "Admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-600"}`}>
                        {u.role_app}
                      </span>
                    )}
                    {alreadyClient && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">✓ Client</span>
                    )}
                  </div>
                  {u.email && <p className="text-xs text-gray-500 truncate mt-0.5">{u.email}</p>}
                  {u.phone_number && <p className="text-xs text-gray-400 mt-0.5">{u.phone_number}</p>}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {(u as any).created_time && (
                      <span className="text-xs text-gray-400">
                        Créé le {(() => { const d = (u as any).created_time; return (d?.toDate ? d.toDate() : new Date(d)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }); })()}
                      </span>
                    )}
                    {(u as any).lastLoginAt && (
                      <span className="text-xs text-gray-400">
                        Dernière co. {(() => { const d = (u as any).lastLoginAt; return (d?.toDate ? d.toDate() : new Date(d)).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); })()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Ligne actions — toujours en dessous, se plie naturellement */}
              <div className="flex flex-wrap gap-2 mt-3 pl-[52px]">
                <button
                  onClick={() => openEdit(u)}
                  className="px-3 py-1.5 text-xs border rounded-lg text-gray-600 hover:bg-gray-100 transition font-medium"
                >
                  Modifier
                </button>
                {!alreadyClient && !isMe && (
                  <button
                    onClick={() => importAsClient(u)}
                    disabled={importing === u.id}
                    className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg transition font-medium"
                  >
                    {importing === u.id ? "Import…" : "→ Importer comme client"}
                  </button>
                )}
                {!isMe && (
                  <button
                    onClick={() => handleImpersonate(u)}
                    disabled={impersonating === u.id}
                    className="px-3 py-1.5 text-xs bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-lg transition font-medium"
                  >
                    {impersonating === u.id ? "Connexion…" : "Prendre la main"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL EDIT */}
      {editModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="px-6 pt-6 pb-4 border-b flex items-center justify-between shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">Modifier l'utilisateur</h2>
              <button onClick={() => setEditModal({ open: false, user: null })} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 overflow-y-auto">
              {/* Photo */}
              <div className="flex flex-col items-center gap-2">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && editModal.user) handlePhotoUpload(f, editModal.user.id);
                  }}
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="relative group"
                >
                  {editForm.photo_url ? (
                    <img src={editForm.photo_url} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-gray-200" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xl border-2 border-gray-200">
                      {(editForm.prenom[0] ?? '') + (editForm.nom[0] ?? '')}
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828A2 2 0 019 16.414V13h2.586z" /></svg>
                  </div>
                </button>
                <p className="text-xs text-gray-400">{uploadingPhoto ? 'Upload en cours…' : 'Cliquer pour changer la photo'}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Prénom *</label>
                  <input className={inputCls} value={editForm.prenom} onChange={(e) => setEditForm((f) => ({ ...f, prenom: toProperName(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nom *</label>
                  <input className={inputCls} value={editForm.nom} onChange={(e) => setEditForm((f) => ({ ...f, nom: toUpperName(e.target.value) }))} />
                </div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-500">
                Email de connexion : <span className="font-medium text-gray-700">{editModal.user?.email}</span>
                <p className="text-xs text-gray-400 mt-0.5">Non modifiable (identifiant de connexion)</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone</label>
                <PhoneInput
                  indicatif={editForm.indicatif_tel}
                  telephone={editForm.phone_number}
                  onIndicatifChange={(v) => setEditForm((f) => ({ ...f, indicatif_tel: v }))}
                  onTelephoneChange={(v) => setEditForm((f) => ({ ...f, phone_number: v }))}
                  inputClassName={inputCls}
                  selectClassName="border rounded-lg px-2 py-2.5 text-sm outline-none focus:border-blue-400 bg-white shrink-0 w-[5.5rem]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Genre</label>
                <div className="flex gap-3">
                  {['Homme', 'Femme'].map((g) => (
                    <button key={g} type="button" onClick={() => setEditForm((f) => ({ ...f, genre: g }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${editForm.genre === g ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date de naissance</label>
                <input type="date" className={inputCls} value={editForm.date_naissance} onChange={(e) => setEditForm((f) => ({ ...f, date_naissance: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Profession</label>
                <SuggestInput className={inputCls} value={editForm.profession} placeholder="Coach sportif…" onChange={(v) => setEditForm((f) => ({ ...f, profession: v }))} suggestions={PROFESSIONS} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Adresse</label>
                <AdresseAutocomplete
                  value={editForm.adresse_postale}
                  onChange={(v) => setEditForm((f) => ({ ...f, adresse_postale: v }))}
                  onSelectFull={(data) => setEditForm((f) => ({ ...f, adresse_postale: data.label, rue_adresse: data.adresse, ville_adresse: data.ville, code_postale_adresse: data.code_postal }))}
                  placeholder="Rechercher une adresse…"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ville</label>
                  <input type="text" className={inputCls} value={editForm.ville_adresse} onChange={(e) => setEditForm((f) => ({ ...f, ville_adresse: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Code postal</label>
                  <input type="text" className={inputCls} value={editForm.code_postale_adresse} onChange={(e) => setEditForm((f) => ({ ...f, code_postale_adresse: e.target.value }))} />
                </div>
              </div>
              {editError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-600">{editError}</div>}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setEditModal({ open: false, user: null })} className="flex-1 border rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition">Annuler</button>
                <button onClick={submitEdit} disabled={editSaving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold transition">
                  {editSaving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
