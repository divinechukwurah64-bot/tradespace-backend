'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import API from '@/lib/api';

const timeLabel = (value: string) => {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString();
};

export default function Inbox() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
      return;
    }

    let cancelled = false;

    const load = async () => {
      if (document.hidden) return;
      try {
        const res = await API.get('/messages/inbox');
        if (!cancelled) {
          setRows(res.data);
          setError('');
        }
      } catch (err: any) {
        if (!cancelled) setError(err.response?.data?.error || 'Could not load your messages');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const timer = setInterval(load, 30000);
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
        Loading your messages...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-black">Messages</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {rows.length === 0 && !error ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
            <p className="font-semibold text-black mb-1">No messages yet</p>
            <p className="text-sm">
              When you message a buyer or seller, or they message you, the conversation shows up here.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow divide-y divide-gray-100">
            {rows.map((row: any) => (
              <Link
                key={row.userId}
                href={`/messages/${row.userId}`}
                className="flex items-center gap-3 p-4 hover:bg-gray-50"
              >
                {row.profileImage ? (
                  <img src={row.profileImage} alt={row.fullName} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
                    {row.fullName?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate ${row.unread > 0 ? 'font-bold text-black' : 'font-semibold text-gray-900'}`}>
                      {row.fullName}
                    </p>
                    <span className="text-xs text-gray-500 flex-shrink-0">{timeLabel(row.lastAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm truncate ${row.unread > 0 ? 'text-black' : 'text-gray-600'}`}>
                      {row.lastFromMe ? 'You: ' : ''}
                      {row.lastMessage}
                    </p>
                    {row.unread > 0 && (
                      <span className="min-w-[20px] h-5 px-1.5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">
                        {row.unread > 99 ? '99+' : row.unread}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}