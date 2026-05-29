"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useCompanies } from "@/hooks/useCompanies";
import { createCompany, updateCompany, deleteCompany } from "@/lib/companyService";
import type { Company } from "@/types";

type Form = {
  nom: string; adresse: string; codePostal: string; ville: string;
  email: string; telephone: string; siret: string; tva: string;
  iban: string; logoUrl: string; couleurPrimaire: string; mentionsLegales: string;
  cgv: string; cgvDate: string;
};

const EMPTY: Form = {
  nom: "", adresse: "", codePostal: "", ville: "", email: "",
  telephone: "", siret: "", tva: "", iban: "", logoUrl: "",
  couleurPrimaire: "#2563eb", mentionsLegales: "", cgv: "", cgvDate: "",
};

const inputCls = "w-full min-w-0 border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition";

function CgvEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  const applyFormat = (action: "bold" | "italic" | "underline" | "tab" | "bullet" | "heading") => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    const scrollTop = ta.scrollTop;

    if (action === "bold" || action === "italic" || action === "underline") {
      const marker = action === "bold" ? "**" : action === "italic" ? "*" : "__";
      const selected = value.slice(start, end);
      const inner = selected || "texte";
      onChange(value.slice(0, start) + `${marker}${inner}${marker}` + value.slice(end));
      setTimeout(() => { ta.focus(); ta.scrollTop = scrollTop; ta.setSelectionRange(start + marker.length, start + marker.length + inner.length); }, 0);
      return;
    }

    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const nlIdx = value.indexOf("\n", start);
    const lineEnd = nlIdx === -1 ? value.length : nlIdx;
    const lineText = value.slice(lineStart, lineEnd);

    if (action === "tab") {
      if (lineText.startsWith("    ")) {
        onChange(value.slice(0, lineStart) + lineText.slice(4) + value.slice(lineEnd));
      } else {
        onChange(value.slice(0, lineStart) + "    " + lineText + value.slice(lineEnd));
      }
    } else {
      const prefix = action === "bullet" ? "- " : "## ";
      const stripped = lineText.trimStart();
      const leading = lineText.slice(0, lineText.length - stripped.length);
      if (stripped.startsWith(prefix)) {
        onChange(value.slice(0, lineStart) + leading + stripped.slice(prefix.length) + value.slice(lineEnd));
      } else {
        onChange(value.slice(0, lineStart) + leading + prefix + stripped + value.slice(lineEnd));
      }
    }
    setTimeout(() => { ta.focus(); ta.scrollTop = scrollTop; }, 0);
  };

  const inlineFormat = (text: string): ReactNode[] =>
    text.split(/(\*\*.*?\*\*|\*.*?\*|__.*?__)/g).map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("__") && part.endsWith("__") && part.length > 4)
        return <span key={i} className="underline">{part.slice(2, -2)}</span>;
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2)
        return <em key={i}>{part.slice(1, -1)}</em>;
      return <span key={i}>{part}</span>;
    });

  const renderPreview = () => {
    const lines = value.split("\n");
    const nodes: ReactNode[] = [];
    let bullets: { text: string; indent: number }[] = [];

    const flushBullets = (key: number) => {
      if (!bullets.length) return;
      nodes.push(
        <ul key={key} className="list-disc my-1 space-y-0.5" style={{ paddingLeft: `${bullets[0].indent * 16 + 20}px` }}>
          {bullets.map((b, i) => <li key={i} className="text-xs text-gray-800">{inlineFormat(b.text)}</li>)}
        </ul>
      );
      bullets = [];
    };

    lines.forEach((line, i) => {
      const spaces = line.match(/^( {4})*/)?.[0].length ?? 0;
      const tabLevel = Math.floor(spaces / 4);
      const content = line.slice(spaces);
      const indent = tabLevel * 16;

      if (!content.trim()) {
        flushBullets(i * 1000);
        nodes.push(<div key={i} className="h-2" />);
      } else if (content.startsWith("## ")) {
        flushBullets(i * 1000 + 1);
        nodes.push(<p key={i} style={{ marginLeft: indent }} className="font-bold text-xs text-gray-900 mt-2 mb-0.5">{inlineFormat(content.slice(3))}</p>);
      } else if (content.startsWith("- ")) {
        bullets.push({ text: content.slice(2), indent: tabLevel });
      } else {
        flushBullets(i * 1000 + 2);
        nodes.push(<p key={i} style={{ marginLeft: indent }} className="text-xs text-gray-800 text-justify leading-relaxed">{inlineFormat(content)}</p>);
      }
    });
    flushBullets(lines.length * 1000);
    return nodes;
  };

  return (
    <div>
      <div className="flex items-center gap-1 border border-b-0 rounded-t-lg bg-gray-50 px-2 py-1.5 flex-wrap">
        <button type="button" onClick={() => applyFormat("bold")} title="Gras (**texte**)" className="px-2.5 py-1 text-xs font-bold border rounded hover:bg-white transition select-none">B</button>
        <button type="button" onClick={() => applyFormat("italic")} title="Italique (*texte*)" className="px-2.5 py-1 text-xs italic border rounded hover:bg-white transition select-none">I</button>
        <button type="button" onClick={() => applyFormat("underline")} title="Souligné (__texte__)" className="px-2.5 py-1 text-xs underline border rounded hover:bg-white transition select-none">S</button>
        <div className="w-px h-4 bg-gray-200 mx-0.5" />
        <button type="button" onClick={() => applyFormat("tab")} title="Tabulation (décaler la ligne)" className="px-2 py-1 text-xs border rounded hover:bg-white transition select-none">⇥ Tab</button>
        <button type="button" onClick={() => applyFormat("bullet")} title="Liste à puces (- texte)" className="px-2 py-1 text-xs border rounded hover:bg-white transition select-none">• Liste</button>
        <button type="button" onClick={() => applyFormat("heading")} title="Titre de section (## titre)" className="px-2 py-1 text-xs border rounded hover:bg-white transition select-none font-semibold">§ Titre</button>
        <div className="flex-1" />
        <button type="button" onClick={() => setPreview((p) => !p)} className="px-2 py-1 text-xs border rounded hover:bg-white transition text-gray-500 select-none">
          {preview ? "Éditer" : "Aperçu"}
        </button>
      </div>
      {preview ? (
        <div className="border border-t-0 rounded-b-lg px-3 py-3 min-h-[12rem] bg-white overflow-y-auto">
          {renderPreview()}
        </div>
      ) : (
        <textarea
          ref={taRef}
          rows={8}
          className="w-full min-w-0 border border-t-0 rounded-b-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition resize-y"
          placeholder={"Saisissez vos conditions générales de vente…\n\n## Article 1 — Objet\n\nLes présentes **conditions** s'appliquent à…\n\n- Élément de liste\n    - Sous-élément (Tab)"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

export default function CompaniesPage() {
  const router = useRouter();
  const { currentUser, userProfile } = useAuth();
  const { companies, loading } = useCompanies();
  const isAdmin = userProfile?.role_app === "Admin";

  useEffect(() => {
    if (userProfile && !isAdmin) router.replace("/accueil");
  }, [userProfile, isAdmin, router]);

  const [modal, setModal] = useState<{ open: boolean; editing: Company | null }>({ open: false, editing: null });
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const openCreate = () => { setForm(EMPTY); setError(""); setModal({ open: true, editing: null }); };
  const openEdit = (c: Company) => {
    setForm({
      nom: c.nom, adresse: c.adresse ?? "", codePostal: c.codePostal ?? "",
      ville: c.ville ?? "", email: c.email ?? "", telephone: c.telephone ?? "",
      siret: c.siret ?? "", tva: c.tva ?? "", iban: c.iban ?? "",
      logoUrl: c.logoUrl ?? "", couleurPrimaire: c.couleurPrimaire ?? "#2563eb",
      mentionsLegales: c.mentionsLegales ?? "", cgv: c.cgv ?? "", cgvDate: c.cgvDate ?? "",
    });
    setError("");
    setModal({ open: true, editing: c });
  };
  const closeModal = () => setModal({ open: false, editing: null });

  const submit = async () => {
    if (!form.nom.trim()) return setError("Le nom de la société est requis.");
    setSaving(true);
    try {
      const data = {
        userId: currentUser!.uid,
        nom: form.nom.trim(),
        adresse: form.adresse || undefined,
        codePostal: form.codePostal || undefined,
        ville: form.ville || undefined,
        email: form.email || undefined,
        telephone: form.telephone || undefined,
        siret: form.siret || undefined,
        tva: form.tva || undefined,
        iban: form.iban || undefined,
        logoUrl: form.logoUrl || undefined,
        couleurPrimaire: form.couleurPrimaire || "#2563eb",
        mentionsLegales: form.mentionsLegales || undefined,
        cgv: form.cgv || undefined,
        cgvDate: form.cgvDate || undefined,
      };
      if (modal.editing) {
        await updateCompany(modal.editing.id, data);
        showToast("Société mise à jour");
      } else {
        await createCompany(data);
        showToast("Société créée");
      }
      closeModal();
    } catch {
      setError("Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteCompany(id);
    setConfirmDelete(null);
    showToast("Société supprimée");
  };

  const set = (field: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  if (!userProfile || !isAdmin) return null;

  return (
    <div className="min-h-screen">
      {toast && (
        <div className="fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium bg-green-600 text-white">{toast}</div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Sociétés</h1>
          <p className="text-sm text-gray-500 mt-0.5">Profils utilisés pour la facturation et les PDF</p>
        </div>
        <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition">
          + Nouvelle société
        </button>
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2].map((i) => <div key={i} className="h-36 bg-white rounded-xl border animate-pulse" />)}
        </div>
      )}

      {!loading && companies.length === 0 && (
        <div className="bg-white rounded-xl border shadow-sm py-14 text-center">
          <p className="text-gray-400 text-sm mb-3">Aucune société configurée</p>
          <button onClick={openCreate} className="text-blue-600 text-sm font-medium hover:underline">Créer votre première société →</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {companies.map((c) => (
          <div key={c.id} className="bg-white rounded-xl border shadow-sm p-5">
            <div className="flex items-start gap-3 mb-3">
              {c.logoUrl ? (
                <img src={c.logoUrl} alt={c.nom} className="w-10 h-10 object-contain rounded" />
              ) : (
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: c.couleurPrimaire ?? "#2563eb" }}>
                  {c.nom[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 truncate">{c.nom}</div>
                {c.ville && <div className="text-xs text-gray-500 mt-0.5">{c.codePostal} {c.ville}</div>}
              </div>
            </div>
            <div className="space-y-1 text-xs text-gray-500">
              {c.email && <div>✉ {c.email}</div>}
              {c.telephone && <div>☎ {c.telephone}</div>}
              {c.siret && <div>SIRET : {c.siret}</div>}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => openEdit(c)} className="flex-1 border rounded-lg py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition">Modifier</button>
              {confirmDelete === c.id ? (
                <div className="flex gap-1.5">
                  <button onClick={() => handleDelete(c.id)} className="px-2.5 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition">Supprimer</button>
                  <button onClick={() => setConfirmDelete(null)} className="px-2.5 py-1.5 text-xs border rounded-lg hover:bg-gray-50 transition">Annuler</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(c.id)} className="px-2.5 py-1.5 text-xs border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition">Supprimer</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* MODAL */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 pt-6 pb-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-gray-900">{modal.editing ? "Modifier la société" : "Nouvelle société"}</h2>
              <button onClick={closeModal} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">
              {/* Identité */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Identité</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nom de la société *</label>
                    <input className={inputCls} placeholder="Teddy Coaching" value={form.nom} onChange={set("nom")} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Adresse</label>
                      <input className={inputCls} placeholder="123 rue de la Paix" value={form.adresse} onChange={set("adresse")} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Code postal</label>
                      <input className={inputCls} placeholder="75001" value={form.codePostal} onChange={set("codePostal")} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Ville</label>
                    <input className={inputCls} placeholder="Paris" value={form.ville} onChange={set("ville")} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                      <input type="email" className={inputCls} value={form.email} onChange={set("email")} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone</label>
                      <input type="tel" className={inputCls} value={form.telephone} onChange={set("telephone")} />
                    </div>
                  </div>
                </div>
              </section>

              {/* Légal */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Informations légales</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">SIRET</label>
                      <input className={inputCls} placeholder="000 000 000 00000" value={form.siret} onChange={set("siret")} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">N° TVA intracommunautaire</label>
                      <input className={inputCls} placeholder="FR00000000000" value={form.tva} onChange={set("tva")} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">IBAN</label>
                    <input className={inputCls} placeholder="FR76 0000 0000 0000 0000 0000 000" value={form.iban} onChange={set("iban")} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Mentions légales (bas de facture)</label>
                    <textarea rows={3} className={inputCls + " resize-none"} placeholder="Ex : Auto-entrepreneur — Dispensé d'immatriculation…" value={form.mentionsLegales} onChange={set("mentionsLegales")} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">CGV — Conditions Générales de Vente</label>
                    <CgvEditor value={form.cgv} onChange={(v) => setForm((f) => ({ ...f, cgv: v }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date de mise à jour des CGV</label>
                    <input type="date" className={inputCls} value={form.cgvDate} onChange={set("cgvDate")} />
                  </div>
                </div>
              </section>

              {/* Visuel PDF */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Visuel PDF</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">URL du logo</label>
                    <input className={inputCls} placeholder="https://..." value={form.logoUrl} onChange={set("logoUrl")} />
                    <p className="text-xs text-gray-400 mt-1">Hébergez votre logo sur Firebase Storage ou Imgur et collez l'URL ici</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Couleur principale</label>
                    <div className="flex items-center gap-3">
                      <input type="color" className="w-10 h-10 rounded border cursor-pointer" value={form.couleurPrimaire} onChange={set("couleurPrimaire")} />
                      <input className={inputCls + " flex-1"} placeholder="#2563eb" value={form.couleurPrimaire} onChange={set("couleurPrimaire")} />
                    </div>
                  </div>
                </div>
              </section>

              {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-600">{error}</div>}

              <div className="flex gap-3 pt-1">
                <button onClick={closeModal} className="flex-1 border rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition">Annuler</button>
                <button onClick={submit} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold transition">
                  {saving ? "Enregistrement..." : modal.editing ? "Enregistrer" : "Créer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
