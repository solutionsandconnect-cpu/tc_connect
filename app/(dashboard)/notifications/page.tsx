'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useNotifications } from '@/hooks/useNotifications'
import Badge from '@/components/ui/Badge'
import { BellIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/outline'

type FilterTab = 'all' | 'unread' | 'read'

export default function NotificationsPage() {
  const router = useRouter()
  const { userProfile } = useAuth()
  const isAdmin = userProfile?.role_app === 'Admin'
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  useEffect(() => {
    if (userProfile && !isAdmin && userProfile.droits?.notifications === false) {
      router.replace('/accueil')
    }
  }, [userProfile, isAdmin, router])

  const { notifications, loading, markAsRead, markAllAsRead, deleteNotification, unreadCount } =
    useNotifications()

  const filtered = useMemo(() => {
    if (activeTab === 'unread') return notifications.filter((n) => n.etat_notification !== 'Lu')
    if (activeTab === 'read') return notifications.filter((n) => n.etat_notification === 'Lu')
    return notifications
  }, [notifications, activeTab])

  const getTypeVariant = (type: string): any => {
    const map: Record<string, any> = {
      Info: 'info',
      Alerte: 'danger',
      Rappel: 'warning',
      Confirmation: 'success',
    }
    return map[type] || 'gray'
  }

  const readCount = notifications.length - unreadCount

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'Tout', count: notifications.length },
    { key: 'unread', label: 'Non lus', count: unreadCount },
    { key: 'read', label: 'Lus', count: readCount },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-blue-600 mt-0.5">{unreadCount} non lue(s)</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-2 text-sm text-blue-600 border border-blue-200 px-3 py-2 rounded-lg hover:bg-blue-50 transition"
          >
            <CheckIcon className="w-4 h-4" />
            Tout marquer lu
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition ${
              activeTab === tab.key
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                activeTab === tab.key && tab.key === 'unread'
                  ? 'bg-blue-600 text-white'
                  : activeTab === tab.key
                  ? 'bg-gray-200 text-gray-600'
                  : 'bg-gray-200 text-gray-500'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <BellIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            {activeTab === 'unread'
              ? 'Aucune notification non lue'
              : activeTab === 'read'
              ? 'Aucune notification lue'
              : 'Aucune notification'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((notif) => {
            const isUnread = notif.etat_notification !== 'Lu'
            const hasLink = !!notif.url
            const handleClick = () => {
              if (isUnread) markAsRead(notif.id)
              if (notif.url) router.push(notif.url)
            }
            return (
              <div
                key={notif.id}
                onClick={handleClick}
                className={`rounded-2xl shadow-sm p-4 transition ${
                  isUnread
                    ? 'border-l-[3px] border-l-blue-500 border border-blue-100 bg-blue-50 cursor-pointer hover:bg-blue-100/60'
                    : hasLink
                    ? 'bg-white border border-gray-100 cursor-pointer hover:bg-gray-50'
                    : 'bg-white border border-gray-100'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {isUnread ? (
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    ) : (
                      <div className="w-2 h-2 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge
                          label={notif.type_notification || 'Info'}
                          variant={getTypeVariant(notif.type_notification)}
                        />
                        <span className="text-xs text-gray-400">
                          {notif.date_create
                            ? (notif.date_create as any).toDate?.().toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </span>
                      </div>
                      <p className={`text-sm ${isUnread ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                        {notif.notification}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isUnread && (
                      <button
                        onClick={(e) => { e.stopPropagation(); markAsRead(notif.id) }}
                        className="p-1.5 rounded-lg border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 transition"
                        title="Marquer comme lu"
                      >
                        <CheckIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id) }}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-500 transition"
                      title="Supprimer"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
