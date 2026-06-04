'use client'

import { useState, useMemo } from 'react'
import { tripProgress, toggleFavorite } from '@/lib/tripsService'
import { tripTypeLabel } from './constants'
import { useAuth } from '@/context/AuthContext'
import { useUserPhotoMap } from '@/hooks/useUserPhotoMap'
import type { Trip } from '@/types'
import { PlusIcon, StarIcon, FunnelIcon, ArchiveBoxIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'

interface Props {
  voyages: Trip[]
  archived: Trip[]
  templates: Trip[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  loading: boolean
  showBrand?: boolean
  canCreate?: boolean
}

type SortKey = 'recent' | 'oldest' | 'alpha' | 'progress'
type FilterKey = 'all' | 'favorites' | 'active' | 'done'

function MemberAvatar({ photoUrl, name }: { photoUrl?: string; name: string }) {
  const initials = name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase() || '?'
  if (photoUrl) {
    return <img src={photoUrl} alt={name} className="w-5 h-5 rounded-full object-cover border border-white" />
  }
  return (
    <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[9px] font-bold border border-white">
      {initials}
    </div>
  )
}

function TripRow({ trip, active, onClick, currentUid, onFavorite, photoMap }: {
  trip: Trip
  active: boolean
  onClick: () => void
  currentUid: string
  onFavorite: (e: React.MouseEvent) => void
  photoMap: Record<string, string>
}) {
  const { pct, total } = tripProgress(trip)
  const isFav = (trip.favoritedBy ?? []).includes(currentUid)

  return (
    // Wrapper relatif pour éviter les <button> imbriqués
    <div className="relative">
      {/* Zone cliquable principale */}
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-2.5 pr-9 rounded-xl text-left transition ${
          active ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'
        }`}
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
          style={{ backgroundColor: trip.color + '20' }}>
          {trip.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${active ? 'text-blue-700' : 'text-gray-800'}`}>
            {trip.name}
          </p>
          <p className="text-xs text-gray-400">
            {total > 0 ? `${pct}% fait` : 'Liste vide'}
            {trip.members.length > 1 && ` · ${trip.members.length}`}
          </p>
        </div>
        {/* Mini-avatars des membres */}
        {trip.members.length > 1 && (
          <div className="flex -space-x-1 shrink-0">
            {trip.members.slice(0, 3).map(m => {
              const name = [m.prenom, m.nom].filter(Boolean).join(' ') || '?'
              const photo = photoMap[m.uid] || m.photoUrl
              return <MemberAvatar key={m.uid} photoUrl={photo} name={name} />
            })}
          </div>
        )}
      </button>

      {/* Bouton favori positionné en absolu pour éviter l'imbrication */}
      <button
        onClick={onFavorite}
        title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-300 hover:text-yellow-400 hover:bg-yellow-50 transition"
      >
        {isFav
          ? <StarSolid className="w-4 h-4 text-yellow-400" />
          : <StarIcon className="w-4 h-4" />
        }
      </button>
    </div>
  )
}

export default function TripSidebar({ voyages, archived, templates, selectedId, onSelect, onCreate, loading, showBrand, canCreate = true }: Props) {
  const { currentUser } = useAuth()
  const uid = currentUser?.uid ?? ''
  const photoMap = useUserPhotoMap()

  const [sort, setSort] = useState<SortKey>('recent')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [category, setCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // Catégories présentes parmi les listes (valeur brute + libellé affiché)
  const categories = useMemo(() => {
    const map = new Map<string, string>()
    voyages.forEach(t => { if (t.type) map.set(t.type, tripTypeLabel(t.type)) })
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr'))
  }, [voyages])

  const sortedVoyages = useMemo(() => {
    let list = [...voyages]
    if (filter === 'favorites') list = list.filter(t => (t.favoritedBy ?? []).includes(uid))
    else if (filter === 'active') list = list.filter(t => { const { pct } = tripProgress(t); return pct < 100 })
    else if (filter === 'done') list = list.filter(t => { const { pct, total } = tripProgress(t); return total > 0 && pct === 100 })

    if (category !== 'all') list = list.filter(t => t.type === category)

    const q = search.trim().toLowerCase()
    if (q) list = list.filter(t => t.name.toLowerCase().includes(q))

    if (sort === 'recent') list.sort((a, b) => (b.updatedAt?.seconds ?? b.createdAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? a.createdAt?.seconds ?? 0))
    else if (sort === 'oldest') list.sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0))
    else if (sort === 'alpha') list.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    else if (sort === 'progress') list.sort((a, b) => tripProgress(b).pct - tripProgress(a).pct)

    // Favoris en tête
    list.sort((a, b) => {
      const aFav = (a.favoritedBy ?? []).includes(uid) ? 0 : 1
      const bFav = (b.favoritedBy ?? []).includes(uid) ? 0 : 1
      return aFav - bFav
    })
    return list
  }, [voyages, sort, filter, category, search, uid])

  const activeFilterCount = (filter !== 'all' ? 1 : 0) + (category !== 'all' ? 1 : 0)

  const handleFavorite = async (e: React.MouseEvent, trip: Trip) => {
    e.stopPropagation()
    await toggleFavorite(trip, uid)
  }

  const SORT_LABELS: Record<SortKey, string> = {
    recent: 'Plus récentes', oldest: 'Plus anciennes',
    alpha: 'Alphabétique', progress: 'Progression',
  }

  return (
    <div className="space-y-3">
      {showBrand && (
        <div className="hidden lg:block pb-2 border-b border-gray-100">
          <p className="text-base font-bold text-gray-800">✅ CheckConnect</p>
        </div>
      )}

      {canCreate ? (
        <button onClick={onCreate}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-xl transition">
          <PlusIcon className="w-4 h-4" /> Nouvelle liste
        </button>
      ) : (
        <div className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 leading-relaxed">
          🔗 Listes partagées avec vous. Pour créer vos propres listes,{' '}
          <a href="/boutique" className="font-semibold text-blue-600 hover:underline">activez CheckConnect</a>.
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Barre de recherche */}
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher une liste…"
              className="w-full text-sm border border-gray-200 rounded-xl pl-9 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Effacer"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 transition">
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Barre filtres */}
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex-1">Mes listes</p>
            <button onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1 p-1.5 rounded-lg transition ${showFilters || activeFilterCount > 0 ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
              title="Filtrer / Trier">
              <FunnelIcon className="w-3.5 h-3.5" />
              {activeFilterCount > 0 && <span className="text-[10px] font-bold">{activeFilterCount}</span>}
            </button>
          </div>

          {showFilters && (
            <div className="space-y-2 bg-gray-50 rounded-xl p-2.5">
              {/* Statut */}
              <div className="flex flex-wrap gap-1">
                {([['all', 'Tout'], ['favorites', '⭐ Favoris'], ['active', 'En cours'], ['done', 'Terminées']] as [FilterKey, string][]).map(([k, label]) => (
                  <button key={k} onClick={() => setFilter(k)}
                    className={`text-[11px] font-medium px-2 py-1 rounded-lg border transition ${
                      filter === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
              {/* Catégorie */}
              {categories.length > 0 && (
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="all">Toutes les catégories</option>
                  {categories.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              )}
              {/* Tri */}
              <select value={sort} onChange={e => setSort(e.target.value as SortKey)}
                className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
                {Object.entries(SORT_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Listes */}
          <div>
            {sortedVoyages.length === 0 ? (
              <p className="text-xs text-gray-400 px-1 py-2">
                {search.trim()
                  ? `Aucune liste pour « ${search.trim()} ».`
                  : (filter !== 'all' || category !== 'all')
                  ? 'Aucune liste dans ce filtre.'
                  : 'Aucune liste. Créez la première !'}
              </p>
            ) : (
              <div className="space-y-1">
                {sortedVoyages.map(t => (
                  <TripRow key={t.id} trip={t} active={t.id === selectedId}
                    onClick={() => onSelect(t.id)} currentUid={uid}
                    onFavorite={e => handleFavorite(e, t)} photoMap={photoMap} />
                ))}
              </div>
            )}
          </div>

          {/* Archives */}
          {archived.length > 0 && (
            <div>
              <button onClick={() => setShowArchived(v => !v)}
                className="w-full flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition px-1 py-1">
                <ArchiveBoxIcon className="w-3.5 h-3.5" />
                Archives ({archived.length})
                <span className="ml-auto">{showArchived ? '▴' : '▾'}</span>
              </button>
              {showArchived && (
                <div className="space-y-1 mt-1">
                  {archived.map(t => (
                    <TripRow key={t.id} trip={t} active={t.id === selectedId}
                      onClick={() => onSelect(t.id)} currentUid={uid}
                      onFavorite={e => handleFavorite(e, t)} photoMap={photoMap} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Modèles */}
          {templates.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Modèles</p>
              <div className="space-y-1">
                {templates.map(t => (
                  <TripRow key={t.id} trip={t} active={t.id === selectedId}
                    onClick={() => onSelect(t.id)} currentUid={uid}
                    onFavorite={e => handleFavorite(e, t)} photoMap={photoMap} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
