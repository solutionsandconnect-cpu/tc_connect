'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useBrand } from '@/context/BrandContext'
import { type Brand } from '@/lib/brand'
import { BrandSwitcher, BrandMark } from '@/components/layout/BrandSwitcher'
import { useNotifications } from '@/hooks/useNotifications'
import { useMessagerieUnread } from '@/hooks/useMessagerieUnread'
import { usePendingSubscriptions } from '@/hooks/usePendingSubscriptions'
import { useUnseenDocuments } from '@/hooks/useUnseenDocuments'
import {
  HomeIcon, CalendarIcon, BellIcon, UserIcon,
  UsersIcon, ClipboardDocumentListIcon, BookOpenIcon,
  DocumentTextIcon, ArrowRightOnRectangleIcon,
  BuildingOfficeIcon, UserGroupIcon, DocumentDuplicateIcon,
  ShieldCheckIcon, ChatBubbleLeftRightIcon, FolderOpenIcon,
  ShoppingBagIcon, FireIcon, PresentationChartLineIcon, FolderIcon,
  RectangleStackIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeSolid, CalendarIcon as CalendarSolid,
  BellIcon as BellSolid, UserIcon as UserSolid,
  UsersIcon as UsersSolid,
  ChatBubbleLeftRightIcon as ChatSolid,
  ClipboardDocumentListIcon as ClipboardSolid,
  BookOpenIcon as BookSolid,
  DocumentTextIcon as DocumentTextSolid,
  BuildingOfficeIcon as BuildingSolid,
  UserGroupIcon as UserGroupSolid,
  ShieldCheckIcon as ShieldSolid,
  DocumentDuplicateIcon as DocumentDupSolid,
  FolderOpenIcon as FolderSolid,
  ShoppingBagIcon as ShoppingBagSolid,
  FireIcon as FireSolid,
  PresentationChartLineIcon as PresentationChartLineSolid,
  RectangleStackIcon as RectangleStackSolid,
} from '@heroicons/react/24/solid'

// Structure organisée par sections
export const navSections = [
  {
    label: null, // pas de titre pour la section principale
    items: [
      { label: 'Accueil',           href: '/accueil',        icon: HomeIcon,                  iconActive: HomeSolid,         adminOnly: false, droit: null },
      { label: 'Planning',          href: '/planning',       icon: CalendarIcon,              iconActive: CalendarSolid,     adminOnly: false, droit: 'planning' as const, marques: ['coaching'] as Brand[] },
      { label: 'Parcours Sportif',  href: '/mes-parcours',   icon: FireIcon,                  iconActive: FireSolid,         adminOnly: false, nonAdminOnly: true, droit: 'parcoursSportif' as const, marques: ['coaching'] as Brand[] },
      { label: 'Notifications',     href: '/notifications',  icon: BellIcon,                  iconActive: BellSolid,         adminOnly: false, droit: 'notifications' as const },
      { label: 'Messagerie',        href: '/messagerie',     icon: ChatBubbleLeftRightIcon,   iconActive: ChatSolid,         adminOnly: false, droit: null },
      { label: 'Documents',         href: '/documents',      icon: FolderOpenIcon,            iconActive: FolderSolid,       adminOnly: false, droit: null, marques: ['coaching'] as Brand[] },
      { label: 'Boutique',          href: '/boutique',       icon: ShoppingBagIcon,           iconActive: ShoppingBagSolid,  adminOnly: false, droit: 'boutique' as const, marques: ['enezo'] as Brand[] },
      { label: 'Mon profil',        href: '/profil',         icon: UserIcon,                  iconActive: UserSolid,         adminOnly: false, droit: null },
    ],
  },
  {
    label: 'Clients & Facturation',
    adminOnly: true,
    items: [
      { label: 'Clients',       href: '/clients',       icon: UsersIcon,                 iconActive: UsersSolid,        adminOnly: true,  droit: null },
      { label: 'Facturation',   href: '/facturation',   icon: DocumentTextIcon,          iconActive: DocumentTextSolid, adminOnly: true,  droit: null },
      { label: 'Sociétés',      href: '/companies',     icon: BuildingOfficeIcon,        iconActive: BuildingSolid,     adminOnly: true,  droit: null },
    ],
  },
  {
    label: 'Coaching',
    adminOnly: true,
    items: [
      { label: 'Séances',          href: '/seances',                    icon: ClipboardDocumentListIcon, iconActive: ClipboardSolid, adminOnly: true,  droit: null },
      { label: 'Exercices',        href: '/exercices',                  icon: BookOpenIcon,              iconActive: BookSolid,      adminOnly: false, droit: 'exercices' as const },
      { label: 'Parcours Sportif', href: '/admin/parcours-sportif',     icon: FireIcon,                  iconActive: FireSolid,     adminOnly: true,  droit: null },
      // Équipes accessible uniquement via la Boutique (StoreGate sur les pages)
    ],
  },
  {
    label: 'Admin',
    adminOnly: true,
    items: [
      { label: 'Pilotage',      href: '/pilotage',      icon: PresentationChartLineIcon, iconActive: PresentationChartLineSolid, adminOnly: true, droit: null },
      { label: 'Utilisateurs',  href: '/users',         icon: UserGroupIcon,             iconActive: UserGroupSolid,    adminOnly: true, droit: null },
      { label: 'Droits d\'accès', href: '/droits',      icon: ShieldCheckIcon,           iconActive: ShieldSolid,       adminOnly: true, droit: null },
      { label: 'Notes',         href: '/notes',         icon: DocumentDuplicateIcon,     iconActive: DocumentDupSolid,  adminOnly: true, droit: null },
      { label: 'Mes apps',      href: '/mes-apps',      icon: RectangleStackIcon,        iconActive: RectangleStackSolid, adminOnly: true, droit: null },
    ],
  },
]

// Flat list for accueil page grid and bottom bar
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const navItems: any[] = navSections.flatMap((s) => s.items as any[])

// Mobile bottom bar
const mobileItems = [
  { label: 'Accueil',  href: '/accueil',       icon: HomeIcon,                iconActive: HomeSolid,         adminOnly: false, nonAdminOnly: false },
  { label: 'Planning', href: '/planning',      icon: CalendarIcon,            iconActive: CalendarSolid,     adminOnly: false, nonAdminOnly: false, marques: ['coaching'] as Brand[] },
  { label: 'Notifs',   href: '/notifications', icon: BellIcon,                iconActive: BellSolid,         adminOnly: false, nonAdminOnly: false },
  { label: 'Messages', href: '/messagerie',    icon: ChatBubbleLeftRightIcon, iconActive: ChatSolid,         adminOnly: false, nonAdminOnly: false },
  { label: 'Clients',  href: '/clients',       icon: UsersIcon,               iconActive: UsersSolid,        adminOnly: true,  nonAdminOnly: false },
  { label: 'Boutique', href: '/boutique',      icon: ShoppingBagIcon,         iconActive: ShoppingBagSolid,  adminOnly: false, nonAdminOnly: true, marques: ['enezo'] as Brand[] },
  { label: 'Profil',   href: '/profil',        icon: UserIcon,                iconActive: UserSolid,         adminOnly: false, nonAdminOnly: false },
]

export default function Navbar({ offsetTop = false }: { offsetTop?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const { logout, userProfile } = useAuth()
  const isAdmin = userProfile?.role_app === 'Admin'
  const droits = userProfile?.droits
  const { brand, allowedBrands, canSwitch, setBrand } = useBrand()

  // Un item marqué d'un/plusieurs univers est masqué si l'univers actif n'en fait pas partie.
  // Admin = voit tout (aucun filtre de marque). Item sans `marques` = partagé.
  const brandAllows = (item: { marques?: Brand[] }) =>
    isAdmin || !item.marques || item.marques.includes(brand)

  const { unreadCount } = useNotifications()
  const messagerieUnread = useMessagerieUnread()
  const pendingSubscriptions = usePendingSubscriptions()
  const unseenDocuments = useUnseenDocuments()

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <>
      {/* ── SIDEBAR desktop ── */}
      {/* offsetTop = bandeau d'impersonation présent (h-11) : on décale la sidebar dessous pour ne pas masquer le logo. */}
      <aside className={`hidden lg:flex flex-col fixed left-0 w-64 bg-white border-r border-gray-200 z-40 ${offsetTop ? 'top-11 h-[calc(100%-2.75rem)]' : 'top-0 h-full'}`}>

        {/* Logo + user */}
        <div className="px-4 py-4 border-b border-gray-100 space-y-3">
          <button onClick={() => router.push('/accueil')} className="flex items-center gap-2.5 hover:opacity-80 transition">
            {brand === 'enezo' ? (
              // Wordmark Enezo (contient déjà le nom) — remplace le combo cible+texte.
              <img src="/logo-enezo-wordmark.png" alt="Enezo" className="h-8 w-auto object-contain" />
            ) : (
              <>
                <BrandMark b={brand} className="w-8 h-8" />
                <h1 className="text-lg font-bold text-blue-600">TC Connect</h1>
              </>
            )}
          </button>
          {userProfile && (
            <button onClick={() => router.push('/profil')} className="flex items-center gap-2.5 w-full hover:bg-gray-50 rounded-xl px-1 py-1 transition">
              {userProfile.photo_url ? (
                <img
                  src={userProfile.photo_url}
                  alt=""
                  className="w-9 h-9 rounded-full object-cover shrink-0 border border-gray-200"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-bold shrink-0">
                  {userProfile.prenom?.[0]}{userProfile.nom?.[0]}
                </div>
              )}
              <div className="min-w-0 text-left">
                <p className="text-sm font-medium text-gray-800 truncate">{userProfile.prenom} {userProfile.nom}</p>
              </div>
            </button>
          )}
          {canSwitch && (
            <div>
              <span className="block px-1 mb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Espace</span>
              <BrandSwitcher brands={allowedBrands} active={brand} onSelect={setBrand} />
            </div>
          )}
        </div>

        {/* Liens groupés */}
        <nav className="flex-1 px-4 py-4 space-y-5 overflow-y-auto">
          {navSections.map((section, si) => {
            // Filter section items by role and droits
            const visibleItems = section.items.filter((item) => {
              if (item.adminOnly && !isAdmin) return false
              if ((item as any).nonAdminOnly && isAdmin) return false
              if (!brandAllows(item as any)) return false
              if (!isAdmin && item.droit) {
                if (item.droit === 'exercices') return (droits as any)?.exercices === true
                return (droits as any)?.[item.droit] !== false
              }

              return true
            })
            if (visibleItems.length === 0) return null
            return (
              <div key={si}>
                {section.label && (
                  <div className="px-3 mb-1">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                      {section.label}
                    </span>
                  </div>
                )}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                    const Icon = isActive ? item.iconActive : item.icon
                    const isNotif = item.href === '/notifications'
                    const isMsg = item.href === '/messagerie'
                    const isBoutique = item.href === '/boutique'
                    const isDocuments = item.href === '/documents'
                    const badgeCount = isNotif ? unreadCount : isMsg ? messagerieUnread : isBoutique ? pendingSubscriptions : isDocuments ? unseenDocuments : 0
                    return (
                      <button
                        key={item.href}
                        onClick={() => router.push(item.href)}
                        className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                          isActive
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {/* Rail « tu es ici » : Or sous Enezo (accent rare), transparent ailleurs. */}
                        {isActive && (
                          <span
                            className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full"
                            style={{ background: 'var(--brand-accent, transparent)' }}
                          />
                        )}
                        <span className="relative shrink-0">
                          <Icon className="w-5 h-5" />
                          {badgeCount > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                              {badgeCount > 9 ? '9+' : badgeCount}
                            </span>
                          )}
                        </span>
                        {item.label}
                        {badgeCount > 0 && (
                          <span className="ml-auto text-xs font-semibold text-white bg-red-500 rounded-full px-1.5 py-0.5 leading-none">
                            {badgeCount > 9 ? '9+' : badgeCount}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Espace client (compte rattaché à une fiche client Pilotage) — univers Enezo */}
          {userProfile?.linkedClientId && brandAllows({ marques: ['enezo'] }) && (
            <div>
              <div className="px-3 mb-1">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Espace client</span>
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={() => router.push('/mon-espace')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    pathname.startsWith('/mon-espace') ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <FolderIcon className="w-5 h-5 shrink-0" />
                  Mon espace
                </button>
              </div>
            </div>
          )}
        </nav>

        {/* Déconnexion */}
        <div className="px-4 py-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ── BOTTOM BAR mobile ── */}
      {/* iOS PWA (standalone) : le rebond élastique repeint la barre `fixed` et la « décolle » au milieu
         de l'écran au relâchement du scroll. On la promeut sur sa propre couche de composition GPU
         (translateZ) pour qu'elle reste épinglée au viewport pendant l'overscroll. */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40"
        style={{
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
      >
        <div className="flex items-center justify-around px-1 pt-1" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))' }}>
          {mobileItems
            .filter((item) => {
              if (item.adminOnly && !isAdmin) return false
              if (item.nonAdminOnly && isAdmin) return false
              if (!brandAllows(item as any)) return false
              if (!isAdmin && (item as any).droit) {
                return (droits as any)?.[(item as any).droit] !== false
              }
              return true
            })
            .map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              const Icon = isActive ? item.iconActive : item.icon
              const isNotif = item.href === '/notifications'
              const isMsg = item.href === '/messagerie'
              const isBoutique = item.href === '/boutique'
              const isDocuments = item.href === '/documents'
              const mobileBadge = isNotif ? unreadCount : isMsg ? messagerieUnread : isBoutique ? pendingSubscriptions : isDocuments ? unseenDocuments : 0
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={`relative flex flex-col items-center gap-0.5 flex-1 py-2 rounded-xl transition ${
                    isActive ? 'text-blue-600' : 'text-gray-400'
                  }`}
                >
                  {/* Rail « tu es ici » : Or sous Enezo (accent rare), transparent ailleurs. */}
                  {isActive && (
                    <span
                      className="absolute top-0 h-0.5 w-6 rounded-full"
                      style={{ background: 'var(--brand-accent, transparent)' }}
                    />
                  )}
                  <span className="relative">
                    <Icon className="w-6 h-6" />
                    {mobileBadge > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                        {mobileBadge > 9 ? '9+' : mobileBadge}
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] font-medium">{item.label}</span>
                </button>
              )
            })}
        </div>
      </nav>
    </>
  )
}
