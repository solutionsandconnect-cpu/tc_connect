'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useNotifications } from '@/hooks/useNotifications'
import { useMessagerieUnread } from '@/hooks/useMessagerieUnread'
import { usePendingSubscriptions } from '@/hooks/usePendingSubscriptions'
import {
  HomeIcon, CalendarIcon, BellIcon, UserIcon,
  UsersIcon, ClipboardDocumentListIcon, BookOpenIcon,
  DocumentTextIcon, ArrowRightOnRectangleIcon,
  BuildingOfficeIcon, UserGroupIcon, DocumentDuplicateIcon,
  ShieldCheckIcon, ChatBubbleLeftRightIcon, FolderOpenIcon,
  ShoppingBagIcon, FireIcon,
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
} from '@heroicons/react/24/solid'

// Structure organisée par sections
export const navSections = [
  {
    label: null, // pas de titre pour la section principale
    items: [
      { label: 'Accueil',           href: '/accueil',        icon: HomeIcon,                  iconActive: HomeSolid,         adminOnly: false, droit: null },
      { label: 'Planning',          href: '/planning',       icon: CalendarIcon,              iconActive: CalendarSolid,     adminOnly: false, droit: 'planning' as const },
      { label: 'Mes Parcours',      href: '/mes-parcours',   icon: FireIcon,                  iconActive: FireSolid,         adminOnly: false, nonAdminOnly: true, droit: 'parcoursSportif' as const },
      { label: 'Notifications',     href: '/notifications',  icon: BellIcon,                  iconActive: BellSolid,         adminOnly: false, droit: 'notifications' as const },
      { label: 'Messagerie',        href: '/messagerie',     icon: ChatBubbleLeftRightIcon,   iconActive: ChatSolid,         adminOnly: false, droit: null },
      { label: 'Documents',         href: '/documents',      icon: FolderOpenIcon,            iconActive: FolderSolid,       adminOnly: false, droit: null },
      { label: 'Boutique',          href: '/boutique',       icon: ShoppingBagIcon,           iconActive: ShoppingBagSolid,  adminOnly: false, droit: 'boutique' as const },
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
      { label: 'Utilisateurs',  href: '/users',         icon: UserGroupIcon,             iconActive: UserGroupSolid,    adminOnly: true, droit: null },
      { label: 'Droits d\'accès', href: '/droits',      icon: ShieldCheckIcon,           iconActive: ShieldSolid,       adminOnly: true, droit: null },
      { label: 'Notes',         href: '/notes',         icon: DocumentDuplicateIcon,     iconActive: DocumentDupSolid,  adminOnly: true, droit: null },
    ],
  },
]

// Flat list for accueil page grid and bottom bar
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const navItems: any[] = navSections.flatMap((s) => s.items as any[])

// Mobile bottom bar
const mobileItems = [
  { label: 'Accueil',  href: '/accueil',       icon: HomeIcon,                iconActive: HomeSolid,         adminOnly: false, nonAdminOnly: false },
  { label: 'Planning', href: '/planning',      icon: CalendarIcon,            iconActive: CalendarSolid,     adminOnly: false, nonAdminOnly: false },
  { label: 'Notifs',   href: '/notifications', icon: BellIcon,                iconActive: BellSolid,         adminOnly: false, nonAdminOnly: false },
  { label: 'Messages', href: '/messagerie',    icon: ChatBubbleLeftRightIcon, iconActive: ChatSolid,         adminOnly: false, nonAdminOnly: false },
  { label: 'Clients',  href: '/clients',       icon: UsersIcon,               iconActive: UsersSolid,        adminOnly: true,  nonAdminOnly: false },
  { label: 'Boutique', href: '/boutique',      icon: ShoppingBagIcon,         iconActive: ShoppingBagSolid,  adminOnly: false, nonAdminOnly: true  },
  { label: 'Profil',   href: '/profil',        icon: UserIcon,                iconActive: UserSolid,         adminOnly: false, nonAdminOnly: false },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { logout, userProfile } = useAuth()
  const isAdmin = userProfile?.role_app === 'Admin'
  const droits = userProfile?.droits

  const { unreadCount } = useNotifications()
  const messagerieUnread = useMessagerieUnread()
  const pendingSubscriptions = usePendingSubscriptions()

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <>
      {/* ── SIDEBAR desktop ── */}
      <aside className="hidden lg:flex flex-col fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-40">

        {/* Logo + user */}
        <div className="px-4 py-4 border-b border-gray-100 space-y-3">
          <button onClick={() => router.push('/accueil')} className="flex items-center gap-2.5 hover:opacity-80 transition">
            <img src="/logo.PNG" alt="TC Connect" className="w-8 h-8 object-contain rounded-lg" />
            <h1 className="text-lg font-bold text-blue-600">TC Connect</h1>
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
                {userProfile.email && <p className="text-xs text-gray-400 truncate">{userProfile.email}</p>}
              </div>
            </button>
          )}
        </div>

        {/* Liens groupés */}
        <nav className="flex-1 px-4 py-4 space-y-5 overflow-y-auto">
          {navSections.map((section, si) => {
            // Filter section items by role and droits
            const visibleItems = section.items.filter((item) => {
              if (item.adminOnly && !isAdmin) return false
              if ((item as any).nonAdminOnly && isAdmin) return false
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
                    const badgeCount = isNotif ? unreadCount : isMsg ? messagerieUnread : isBoutique ? pendingSubscriptions : 0
                    return (
                      <button
                        key={item.href}
                        onClick={() => router.push(item.href)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                          isActive
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
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
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="flex items-center justify-around px-1 pt-1" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))' }}>
          {mobileItems
            .filter((item) => {
              if (item.adminOnly && !isAdmin) return false
              if (item.nonAdminOnly && isAdmin) return false
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
              const mobileBadge = isNotif ? unreadCount : isMsg ? messagerieUnread : isBoutique ? pendingSubscriptions : 0
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={`flex flex-col items-center gap-0.5 flex-1 py-2 rounded-xl transition ${
                    isActive ? 'text-blue-600' : 'text-gray-400'
                  }`}
                >
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
