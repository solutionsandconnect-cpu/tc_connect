'use client'

import { useNotifications } from '@/hooks/useNotifications'
import Badge from '@/components/ui/Badge'
import { BellIcon, CheckIcon } from '@heroicons/react/24/outline'

export default function NotificationsPage() {
  const { notifications, loading, markAsRead, markAllAsRead, deleteNotification, unreadCount } =
    useNotifications()

  const getTypeVariant = (type: string): any => {
    const map: Record<string, any> = {
      Info: 'info',
      Alerte: 'danger',
      Rappel: 'warning',
      Confirmation: 'success',
    }
    return map[type] || 'gray'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-blue-600">{unreadCount} non lue(s)</p>
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

      {loading ? (
        <div className="text-center py-10 text-gray-400">Chargement...</div>
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <BellIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Aucune notification</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const isUnread = notif.etat_notification !== 'Lu'
            return (
              <div
                key={notif.id}
                className={`bg-white rounded-2xl border shadow-sm p-4 transition ${
                  isUnread ? 'border-blue-100 bg-blue-50/30' : 'border-gray-100'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {isUnread && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    )}
                    <div className={isUnread ? '' : 'ml-5'}>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          label={notif.type_notification || 'Info'}
                          variant={getTypeVariant(notif.type_notification)}
                        />
                        <span className="text-xs text-gray-400">
                          {notif.date_create
                            ? (notif.date_create as any).toDate().toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800">{notif.notification}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {isUnread && (
                      <button
                        onClick={() => markAsRead(notif.id)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Lu
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notif.id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Supprimer
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