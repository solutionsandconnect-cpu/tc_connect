'use client'

// Charte graphique & cadrage d'un contrat : éditeur + aperçu lecture seule.
import { useEffect, useRef, useState } from 'react'
import { PlusIcon, TrashIcon, XMarkIcon, ArrowUpTrayIcon, DocumentIcon } from '@heroicons/react/24/outline'
import type { ChartGraphique, ChartCouleur } from '@/types'
import { StringListEditor } from '@/components/pilotage/ProjetUI'

const TYPE_PROJET = [
  { k: 'application', l: 'Application' },
  { k: 'site_web', l: 'Site web' },
  { k: 'autre', l: 'Autre' },
] as const
// Legacy keys (app_mobile / app_web) regroupées sous « Application »
const TYPE_LABEL: Record<string, string> = { application: 'Application', app_mobile: 'Application', app_web: 'Application', site_web: 'Site web', autre: 'Autre' }
const PLATEFORMES = [{ k: 'ios', l: 'iOS' }, { k: 'android', l: 'Android' }, { k: 'web', l: 'Web' }] as const
const PLAT_LABEL: Record<string, string> = { ios: 'iOS', android: 'Android', web: 'Web' }
const COULEURS_DEFAUT: ChartCouleur[] = [
  { label: 'Primaire', hex: '#2563eb' },
  { label: 'Secondaire', hex: '#64748b' },
  { label: 'Accent', hex: '#f59e0b' },
]
// Drapeaux via images (les emojis-drapeaux ne s'affichent pas sur Windows → on rend de vraies images)
const LANGUES_DEF = [
  { nom: 'Français', code: 'fr' }, { nom: 'English', code: 'gb' }, { nom: 'Español', code: 'es' },
  { nom: 'Deutsch', code: 'de' }, { nom: 'Italiano', code: 'it' }, { nom: 'Português', code: 'pt' },
  { nom: 'Nederlands', code: 'nl' }, { nom: 'العربية', code: 'sa' }, { nom: '中文', code: 'cn' },
] as const
const LANGUES = LANGUES_DEF.map((l) => l.nom)
const LANGUE_CODE: Record<string, string> = Object.fromEntries(LANGUES_DEF.map((l) => [l.nom, l.code]))
function Flag({ code }: { code?: string }) {
  if (!code) return null
  return <img src={`https://flagcdn.com/20x15/${code}.png`} srcSet={`https://flagcdn.com/40x30/${code}.png 2x`} alt="" width={20} height={15} className="rounded-sm shrink-0" />
}
const TYPOS = ['Inter', 'Poppins', 'Roboto', 'Montserrat', 'Open Sans', 'Lato', 'Nunito', 'Raleway', 'Work Sans', 'Playfair Display']
const TONS = ['Moderne', 'Sobre', 'Minimaliste', 'Épuré', 'Premium', 'Professionnel', 'Chaleureux', 'Fun', 'Coloré', 'Audacieux']

export function defaultCharte(over: Partial<ChartGraphique> = {}): ChartGraphique {
  // Coerce les champs liste (tolère d'anciennes valeurs en texte)
  const toList = (x: unknown): string[] => (Array.isArray(x) ? (x as string[]) : (typeof x === 'string' && x.trim() ? [x] : []))
  return {
    usersMin: 0, usersMax: 50,
    plateformes: [], couleurs: [], liens: [], fichiers: [], ...over,
    objectifs: toList(over.objectifs), contraintes: toList(over.contraintes),
    langues: toList(over.langues), typographie: toList(over.typographie), ton: toList(over.ton),
  }
}

const lbl = 'text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1'
const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const chipCls = (on: boolean) => `text-xs px-2.5 py-1 rounded-full border transition ${on ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400'}`
const isImg = (name: string) => /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(name)

// Sélecteur multi-valeurs : chips + ajout via présélections (dropdown) ou saisie libre
function TagPicker({ value, options, onChange, placeholder, flagFor }: { value: string[]; options: string[]; onChange: (v: string[]) => void; placeholder?: string; flagFor?: (v: string) => string | undefined }) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  const add = (v: string) => { const t = v.trim(); if (t && !value.includes(t)) onChange([...value, t]); setText(''); setOpen(false) }
  const q = text.trim().toLowerCase()
  const suggestions = options.filter((o) => !value.includes(o) && (!q || o.toLowerCase().includes(q)))
  const canCustom = q.length > 0 && !options.some((o) => o.toLowerCase() === q) && !value.some((v) => v.toLowerCase() === q)
  return (
    <div ref={ref} className="space-y-1.5">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full pl-2 pr-1 py-1">
              {flagFor && <Flag code={flagFor(v)} />}
              {v}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="rounded-full hover:bg-blue-100 p-0.5"><XMarkIcon className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input value={text} placeholder={placeholder} onFocus={() => setOpen(true)} onChange={(e) => { setText(e.target.value); setOpen(true) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(text) } }} className={inp} />
        {open && (suggestions.length > 0 || canCustom) && (
          <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto py-1">
            {suggestions.map((o) => (
              <button key={o} type="button" onMouseDown={(e) => { e.preventDefault(); add(o) }} className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-blue-50 transition flex items-center gap-2">
                {flagFor && <Flag code={flagFor(o)} />}{o}
              </button>
            ))}
            {canCustom && (
              <button type="button" onMouseDown={(e) => { e.preventDefault(); add(text) }} className="w-full text-left px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 border-t border-gray-100 flex items-center gap-1.5 transition">
                <PlusIcon className="w-3.5 h-3.5" /> Ajouter « {text.trim()} »
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function CharteEditor({ value, onChange, onUpload }: {
  value: ChartGraphique; onChange: (v: ChartGraphique) => void
  onUpload?: (file: File) => Promise<{ name: string; url: string }>
}) {
  const upd = (patch: Partial<ChartGraphique>) => onChange({ ...value, ...patch })
  const couleurs = value.couleurs?.length ? value.couleurs : COULEURS_DEFAUT
  const updCouleur = (i: number, patch: Partial<ChartCouleur>) => upd({ couleurs: couleurs.map((c, j) => (j === i ? { ...c, ...patch } : c)) })
  const togglePlateforme = (k: string) => {
    const cur = value.plateformes ?? []
    upd({ plateformes: cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k] })
  }
  const numOf = (s: string) => (s === '' ? undefined : Math.max(0, parseInt(s, 10) || 0))
  const [uploading, setUploading] = useState(false)
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !onUpload) return
    setUploading(true)
    try { const f = await onUpload(file); upd({ fichiers: [...(value.fichiers ?? []), f] }) }
    catch (err) { console.error('[charte upload]', err) }
    setUploading(false)
  }
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !onUpload) return
    setUploadingLogo(true)
    try { const f = await onUpload(file); upd({ logo: f }) }
    catch (err) { console.error('[charte logo]', err) }
    setUploadingLogo(false)
  }
  return (
    <div className="space-y-5">
      <div>
        <p className={lbl}>Objectifs du projet</p>
        <StringListEditor items={value.objectifs ?? []} onChange={(v) => upd({ objectifs: v })} placeholder="Un objectif…" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <p className={lbl}>Type de projet</p>
          <div className="flex flex-wrap gap-1.5">
            {TYPE_PROJET.map((t) => {
              const cur = value.typeProjet === 'app_mobile' || value.typeProjet === 'app_web' ? 'application' : value.typeProjet
              const on = cur === t.k
              return <button key={t.k} type="button" onClick={() => upd({ typeProjet: on ? undefined : t.k })} className={chipCls(on)}>{t.l}</button>
            })}
          </div>
          {value.typeProjet === 'autre' && (
            <input value={value.typeAutre ?? ''} onChange={(e) => upd({ typeAutre: e.target.value })} className={`${inp} mt-1.5`} placeholder="Précise le type (ex : extension, logiciel desktop…)" />
          )}
        </div>
        <div>
          <p className={lbl}>Nom de l'app / projet</p>
          <input value={value.nomApp ?? ''} onChange={(e) => upd({ nomApp: e.target.value })} className={inp} />
        </div>
      </div>

      {onUpload && (
        <div>
          <p className={lbl}>Logo</p>
          {value.logo ? (
            <div className="flex items-center gap-3">
              <img src={value.logo.url} alt="logo" className="w-16 h-16 rounded-lg object-contain border border-gray-200 bg-white p-1 shrink-0" />
              <a href={value.logo.url} target="_blank" rel="noreferrer" className="flex-1 min-w-0 text-sm text-blue-600 hover:underline truncate">{value.logo.name}</a>
              <label className="text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0">
                {uploadingLogo ? 'Envoi…' : 'Remplacer'}
                <input type="file" accept="image/*" className="hidden" disabled={uploadingLogo} onChange={handleLogo} />
              </label>
              <button type="button" onClick={() => upd({ logo: undefined })} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition shrink-0"><TrashIcon className="w-4 h-4" /></button>
            </div>
          ) : (
            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition cursor-pointer w-fit">
              <ArrowUpTrayIcon className="w-3.5 h-3.5" /> {uploadingLogo ? 'Envoi…' : 'Ajouter le logo'}
              <input type="file" accept="image/*" className="hidden" disabled={uploadingLogo} onChange={handleLogo} />
            </label>
          )}
        </div>
      )}

      <div>
        <p className={lbl}>Plateformes</p>
        <div className="flex flex-wrap gap-1.5">
          {PLATEFORMES.map((p) => (
            <button key={p.k} type="button" onClick={() => togglePlateforme(p.k)} className={chipCls((value.plateformes ?? []).includes(p.k))}>{p.l}</button>
          ))}
        </div>
      </div>

      <div>
        <p className={lbl}>Public cible</p>
        <p className="text-[11px] text-gray-400 mb-1">À <strong>qui</strong> s'adresse l'app — le profil des utilisateurs (ex : « salariés terrain de l'entreprise », « clients particuliers 25-45 ans », « adhérents du club »).</p>
        <textarea rows={2} value={value.publicCible ?? ''} onChange={(e) => upd({ publicCible: e.target.value })} className={`${inp} resize-none`} placeholder="Profil, métier, âge, contexte d'usage…" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <p className={lbl}>Utilisateurs min</p>
          <input type="number" min={0} value={value.usersMin ?? ''} onChange={(e) => upd({ usersMin: numOf(e.target.value) })} className={inp} />
        </div>
        <div>
          <p className={lbl}>Utilisateurs max</p>
          <input type="number" min={0} value={value.usersMax ?? ''} onChange={(e) => upd({ usersMax: numOf(e.target.value) })} className={inp} />
        </div>
        <div>
          <p className={lbl}>Domaine souhaité</p>
          <input value={value.domaine ?? ''} onChange={(e) => upd({ domaine: e.target.value })} className={inp} placeholder="ex : monapp.fr" />
        </div>
      </div>
      <p className="text-[11px] text-gray-400 -mt-1 leading-relaxed">
        Repère hébergement : <strong>≤ 50 utilisateurs</strong> → Firebase ~gratuit (palier Spark/Blaze). Au-delà, prévoir un coût récurrent selon l’usage (lectures/écritures, stockage, vidéo). Pour chiffrer une fourchette : onglet <strong>Calculateur</strong> → « Estimation des coûts d’infrastructure ».
      </p>

      <div>
        <p className={lbl}>Langue(s)</p>
        <TagPicker value={value.langues ?? []} options={LANGUES} onChange={(v) => upd({ langues: v })} placeholder="Choisis ou tape une langue…" flagFor={(v) => LANGUE_CODE[v]} />
      </div>

      <div>
        <p className={lbl}>Couleurs</p>
        <div className="space-y-1.5">
          {couleurs.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="color" value={c.hex} onChange={(e) => updCouleur(i, { hex: e.target.value })} className="w-9 h-9 rounded border border-gray-300 cursor-pointer shrink-0 p-0.5" />
              <input value={c.label} placeholder="Rôle (ex : Primaire)" onChange={(e) => updCouleur(i, { label: e.target.value })} className="w-44 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-xs text-gray-400 tabular-nums uppercase">{c.hex}</span>
              <button type="button" onClick={() => upd({ couleurs: couleurs.filter((_, j) => j !== i) })} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition ml-auto"><TrashIcon className="w-4 h-4" /></button>
            </div>
          ))}
          <button type="button" onClick={() => upd({ couleurs: [...couleurs, { label: '', hex: '#000000' }] })} className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-lg transition"><PlusIcon className="w-3.5 h-3.5" /> Ajouter une couleur</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <p className={lbl}>Typographie(s) / police(s)</p>
          <TagPicker value={value.typographie ?? []} options={TYPOS} onChange={(v) => upd({ typographie: v })} placeholder="Choisis ou tape une police…" />
        </div>
        <div>
          <p className={lbl}>Ton / style</p>
          <TagPicker value={value.ton ?? []} options={TONS} onChange={(v) => upd({ ton: v })} placeholder="Choisis ou tape un style…" />
        </div>
      </div>

      <div>
        <p className={lbl}>Liens / références (inspirations)</p>
        <StringListEditor items={value.liens ?? []} onChange={(v) => upd({ liens: v })} placeholder="https://…" />
      </div>

      <div>
        <p className={lbl}>Contraintes &amp; spécifications techniques</p>
        <StringListEditor items={value.contraintes ?? []} onChange={(v) => upd({ contraintes: v })} placeholder="ex : intégration compta, mode hors-ligne, hébergement imposé…" />
      </div>

      {onUpload && (
        <div>
          <p className={lbl}>Autres fichiers / images</p>
          <div className="space-y-1.5">
            {(value.fichiers ?? []).map((f, i) => (
              <div key={i} className="flex items-center gap-2 border border-gray-100 rounded-lg p-2">
                {isImg(f.name)
                  ? <img src={f.url} alt="" className="w-9 h-9 rounded object-cover border border-gray-200 shrink-0" />
                  : <span className="w-9 h-9 rounded bg-gray-100 flex items-center justify-center text-gray-400 shrink-0"><DocumentIcon className="w-4 h-4" /></span>}
                <a href={f.url} target="_blank" rel="noreferrer" className="flex-1 min-w-0 text-sm text-blue-600 hover:underline truncate">{f.name}</a>
                <button type="button" onClick={() => upd({ fichiers: (value.fichiers ?? []).filter((_, j) => j !== i) })} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition shrink-0"><TrashIcon className="w-4 h-4" /></button>
              </div>
            ))}
            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition cursor-pointer w-fit">
              <ArrowUpTrayIcon className="w-3.5 h-3.5" /> {uploading ? 'Envoi…' : 'Ajouter un fichier / image'}
              <input type="file" className="hidden" disabled={uploading} onChange={handleFile} />
            </label>
          </div>
        </div>
      )}

      <div>
        <p className={lbl}>Notes / contraintes de marque</p>
        <p className="text-[11px] text-gray-400 mb-1">Tout ce qui <strong>encadre</strong> le visuel : logo/charte existants à respecter, codes de la maison-mère, éléments à <strong>éviter</strong>, mentions obligatoires, do &amp; don't.</p>
        <textarea rows={2} value={value.notes ?? ''} onChange={(e) => upd({ notes: e.target.value })} className={`${inp} resize-none`} placeholder="ex : garder le logo actuel, éviter le rouge, ton tutoiement…" />
      </div>
    </div>
  )
}

// ── Aperçu lecture seule ──
function ApLabel({ t, children }: { t: string; children: React.ReactNode }) {
  return <div><dt className="text-[11px] text-gray-400">{t}</dt><dd className="text-sm text-gray-700 whitespace-pre-wrap">{children}</dd></div>
}
function ApSection({ t, children }: { t: string; children: React.ReactNode }) {
  return <section><h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{t}</h3>{children}</section>
}
const badge = (s: string, i: number) => <span key={i} className="text-[10px] font-medium rounded-full px-2 py-0.5 bg-gray-100 text-gray-600">{s}</span>

export function CharteApercu({ value: v }: { value: ChartGraphique }) {
  const objectifs = (v.objectifs ?? []).filter(Boolean)
  const contraintes = (v.contraintes ?? []).filter(Boolean)
  const couleurs = (v.couleurs ?? []).filter((c) => c.hex)
  const liens = (v.liens ?? []).filter(Boolean)
  const fichiers = v.fichiers ?? []
  const plateformes = v.plateformes ?? []
  const langues = v.langues ?? []
  const typos = v.typographie ?? []
  const tons = v.ton ?? []
  const typeTxt = v.typeProjet ? (v.typeProjet === 'autre' ? (v.typeAutre || 'Autre') : (TYPE_LABEL[v.typeProjet] ?? v.typeProjet)) : ''
  const users = v.usersMin != null || v.usersMax != null ? `${v.usersMin ?? '?'} – ${v.usersMax ?? '?'} utilisateurs` : ''
  const vide = !(v.logo || objectifs.length || typeTxt || v.nomApp || v.publicCible || users || plateformes.length || v.domaine || langues.length || couleurs.length || typos.length || tons.length || liens.length || fichiers.length || contraintes.length || v.notes)
  if (vide)
    return <p className="text-sm text-gray-400 text-center py-10">Rien pour l'instant.<br />Clique sur « Modifier » pour remplir la charte.</p>
  return (
    <div className="space-y-5">
      {v.logo && (
        <ApSection t="Logo">
          <a href={v.logo.url} target="_blank" rel="noreferrer" className="inline-block">
            <img src={v.logo.url} alt="logo" className="w-20 h-20 rounded-lg object-contain border border-gray-200 bg-white p-1.5" />
          </a>
        </ApSection>
      )}
      {objectifs.length > 0 && (
        <ApSection t="Objectifs du projet">
          <ul className="space-y-1 text-sm text-gray-700">
            {objectifs.map((o, i) => <li key={i} className="flex gap-2"><span className="text-blue-500 shrink-0">•</span>{o}</li>)}
          </ul>
        </ApSection>
      )}

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {typeTxt && <ApLabel t="Type de projet">{typeTxt}</ApLabel>}
        {v.nomApp && <ApLabel t="Nom de l'app">{v.nomApp}</ApLabel>}
        {users && <ApLabel t="Utilisateurs envisagés">{users}</ApLabel>}
        {plateformes.length > 0 && <div><dt className="text-[11px] text-gray-400">Plateformes</dt><dd className="flex flex-wrap gap-1 mt-0.5">{plateformes.map((p, i) => badge(PLAT_LABEL[p] ?? p, i))}</dd></div>}
        {v.domaine && <ApLabel t="Domaine souhaité">{v.domaine}</ApLabel>}
        {langues.length > 0 && <div><dt className="text-[11px] text-gray-400">Langue(s)</dt><dd className="flex flex-wrap gap-x-2.5 gap-y-1 mt-0.5">{langues.map((l, i) => <span key={i} className="inline-flex items-center gap-1 text-xs text-gray-700"><Flag code={LANGUE_CODE[l]} />{l}</span>)}</dd></div>}
        {typos.length > 0 && <div><dt className="text-[11px] text-gray-400">Typographie(s)</dt><dd className="flex flex-wrap gap-1 mt-0.5">{typos.map(badge)}</dd></div>}
        {tons.length > 0 && <div><dt className="text-[11px] text-gray-400">Ton / style</dt><dd className="flex flex-wrap gap-1 mt-0.5">{tons.map(badge)}</dd></div>}
      </dl>

      {v.publicCible && <ApSection t="Public cible"><p className="text-sm text-gray-700 whitespace-pre-wrap">{v.publicCible}</p></ApSection>}

      {couleurs.length > 0 && (
        <ApSection t="Couleurs">
          <div className="flex flex-wrap gap-3">
            {couleurs.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6 h-6 rounded border border-gray-200 shrink-0" style={{ backgroundColor: c.hex }} />
                <span className="text-xs text-gray-700">{c.label || '—'} <span className="text-gray-400 tabular-nums uppercase">{c.hex}</span></span>
              </div>
            ))}
          </div>
        </ApSection>
      )}

      {fichiers.length > 0 && (
        <ApSection t="Autres fichiers / images">
          <div className="flex flex-wrap gap-2">
            {fichiers.map((f, i) => (
              <a key={i} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 border border-gray-100 rounded-lg p-2 hover:bg-gray-50 transition max-w-[14rem]">
                {isImg(f.name)
                  ? <img src={f.url} alt="" className="w-9 h-9 rounded object-cover border border-gray-200 shrink-0" />
                  : <span className="w-9 h-9 rounded bg-gray-100 flex items-center justify-center text-gray-400 shrink-0"><DocumentIcon className="w-4 h-4" /></span>}
                <span className="text-sm text-blue-600 truncate">{f.name}</span>
              </a>
            ))}
          </div>
        </ApSection>
      )}

      {liens.length > 0 && (
        <ApSection t="Liens / références">
          <ul className="space-y-1">
            {liens.map((l, i) => <li key={i}><a href={l} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline break-all">{l}</a></li>)}
          </ul>
        </ApSection>
      )}

      {contraintes.length > 0 && (
        <ApSection t="Contraintes & spécifications techniques">
          <ul className="space-y-1 text-sm text-gray-700">
            {contraintes.map((c, i) => <li key={i} className="flex gap-2"><span className="text-blue-500 shrink-0">•</span>{c}</li>)}
          </ul>
        </ApSection>
      )}
      {v.notes && <ApSection t="Notes / contraintes de marque"><p className="text-sm text-gray-700 whitespace-pre-wrap">{v.notes}</p></ApSection>}
    </div>
  )
}
