'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  HomeIcon, CalendarIcon, BellIcon, UserIcon,
  UsersIcon, ClipboardDocumentListIcon, BookOpenIcon,
  ChartBarIcon, DocumentTextIcon, ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeSolid, CalendarIcon as CalendarSolid,
  BellIcon as BellSolid, UserIcon as UserSolid,
} from '@heroicons/react/24/solid'

const navItems = [
  { label: 'Accueil',        href: '/accueil',        icon: HomeIcon,                    iconActive: HomeSolid },
  { label: 'Planning',       href: '/planning',       icon: CalendarIcon,                iconActive: CalendarSolid },
  { label: 'Notifications',  href: '/notifications',  icon: BellIcon,                    iconActive: BellSolid },
  { label: 'Mon profil',     href: '/profil',         icon: UserIcon,                    iconActive: UserSolid },
  { label: 'Équipes',        href: '/equipes',        icon: UsersIcon,                   iconActive: UsersIcon },
  { label: 'Séances',        href: '/seances',        icon: ClipboardDocumentListIcon,   iconActive: ClipboardDocumentListIcon },
  { label: 'Exercices',      href: '/exercices',      icon: BookOpenIcon,                iconActive: BookOpenIcon },
  { label: 'RPE',            href: '/rpe',            icon: ChartBarIcon,                iconActive: ChartBarIcon },
  { label: 'Notes',          href: '/notes',          icon: DocumentTextIcon,            iconActive: DocumentTextIcon },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { logout, userProfile } = useAuth()

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <>
      {/* ── SIDEBAR desktop ── */}
      <aside className="hidden lg:flex flex-col fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-40">

        {/* Logo */}
        <div className="px-6 py-6 border-b border-gray-100">
          <h1 className="text-xl font-bold text-blue-600">TC Connect</h1>
          {userProfile && (
            <p className="text-xs text-gray-500 mt-1 truncate">
              {userProfile.prenom} {userProfile.nom}
            </p>
          )}
        </div>

        {/* Liens */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = isActive ? item.iconActive : item.icon
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
                <Icon className="w-5 h-5 shrink-0" />
                {item.label}
              </button>
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
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.slice(0, 4).map((item) => {
            const isActive = pathname === item.href
            const Icon = isActive ? item.iconActive : item.icon
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition ${
                  isActive ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}