'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import API from '@/lib/api';

const timeAgo = (date: string) => {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const response = await API.get('/notifications');
      setItems(response.data.items);
      setUnread(response.data.unreadCount);
    } catch (err) {
      // stay quiet if it fails
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const openItem = async (n: any) => {
    if (!n.readAt) {
      try {
        await API.post(`/notifications/${n._id}/read`);
      } catch (err) {
        // ignore
      }
    }
    setOpen(false);
    if (n.link) router.push(n.link);
    load();
  };

  const markAll = async () => {
    try {
      await API.post('/notifications/read-all');
    } catch (err) {
      // ignore
    }
    load();
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => {
          setOpen(!open);
          if (!open) load();
        }}
        className="relative p-2 text-gray-700 hover:text-blue-600"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-xl border border-gray-200 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="font-bold text-black text-sm">Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs text-blue-600 hover:underline">
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500">Nothing here yet</p>
            ) : (
              items.map((n) => (
                <button
                  key={n._id}
                  onClick={() => openItem(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 ${
                    n.readAt ? '' : 'bg-blue-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm text-black">{n.title}</p>
                    <span className="text-xs text-gray-500 flex-shrink-0">{timeAgo(n.createdAt)}</span>
                  </div>
                  {n.message && <p className="text-xs text-gray-600 mt-1">{n.message}</p>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}