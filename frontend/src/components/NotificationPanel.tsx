import { useEffect, useRef, useState } from 'react'
import { Bell, X, CheckCheck } from 'lucide-react'
import api from '../api/client'
import { formatDateTime } from '../utils/helpers'

interface Notification {
  id: string; type: string; title: string; body: string;
  is_read: boolean; created_at: string; ticket_id?: number
}

let lastNotifIds = new Set<string>()
let audioCtx: AudioContext | null = null

function playNotifSound() {
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    const oscillator = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime)
    oscillator.frequency.setValueAtTime(660, audioCtx.currentTime + 0.1)
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4)
    oscillator.start(audioCtx.currentTime)
    oscillator.stop(audioCtx.currentTime + 0.4)
  } catch {}
}

function requestBrowserPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

function showBrowserNotif(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/logo-icon.png' })
  }
}

export default function NotificationPanel() {
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)

  const load = async (silent = false) => {
    try {
      const { data } = await api.get('/users/notifications')
      const newNotifs: Notification[] = data.notifications || []

      if (!silent) {
        // Найти новые уведомления которых ещё не было
        const newOnes = newNotifs.filter(n => !lastNotifIds.has(n.id) && !n.is_read)
        if (newOnes.length > 0 && lastNotifIds.size > 0) {
          playNotifSound()
          newOnes.forEach(n => showBrowserNotif(n.title || 'Уведомление', n.body || ''))
        }
        newNotifs.forEach(n => lastNotifIds.add(n.id))
      } else {
        newNotifs.forEach(n => lastNotifIds.add(n.id))
      }

      setNotifs(newNotifs)
      setUnread(data.unread || 0)
    } catch {}
  }

  useEffect(() => {
    requestBrowserPermission()
    load(true) // первая загрузка без звука
    const interval = setInterval(() => load(false), 15000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const markAllRead = async () => {
    try {
      await api.post('/users/notifications/read-all')
      setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnread(0)
    } catch {}
  }

  const handleOpen = () => {
    setOpen(v => !v)
    if (!open && unread > 0) markAllRead()
  }

  return (
    <div className="relative" ref={panelRef}>
      <button onClick={handleOpen} className="relative text-[#71717A] hover:text-[#18181B] transition-colors">
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#CC0033] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 w-[360px] bg-white rounded-xl border border-[#E4E4E7] shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E4E4E7]">
            <span className="font-semibold text-[#18181B] text-sm">Уведомления</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-[#003399] hover:underline flex items-center gap-1">
                  <CheckCheck size={13} /> Прочитать все
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-[#A1A1AA] hover:text-[#18181B]"><X size={16} /></button>
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto divide-y divide-[#F4F4F5]">
            {notifs.length === 0 && (
              <div className="py-10 text-center text-[#A1A1AA] text-sm">Уведомлений нет</div>
            )}
            {notifs.map(n => (
              <div key={n.id} className={`px-4 py-3 transition-colors ${n.is_read ? 'bg-white' : 'bg-[#FFF8F8]'}`}>
                <div className="flex items-start gap-2.5">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.is_read ? 'bg-transparent' : 'bg-[#CC0033]'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#18181B]">{n.title || 'Уведомление'}</div>
                    {n.body && <div className="text-xs text-[#71717A] mt-0.5 line-clamp-2">{n.body}</div>}
                    <div className="text-[10px] text-[#A1A1AA] mt-1">{formatDateTime(n.created_at)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
