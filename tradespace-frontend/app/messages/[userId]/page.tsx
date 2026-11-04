'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import API from '@/lib/api';
import { confirmDialog, toast } from '@/lib/dialogs';

const MAX_LENGTH = 2000;

// Works whether the sender is a plain id or a populated user
const senderOf = (message: any) =>
  String((message.senderId && message.senderId._id) || message.senderId);

const timeLabel = (value: string) =>
  new Date(value).toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function Conversation() {
  const params = useParams();
  const userId = String((params as any).userId || '');

  const [me, setMe] = useState<any>(null);
  const [partner, setPartner] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const fetchMessages = async () => {
    const res = await API.get(`/messages/conversation/${userId}`);
    const list: any[] = res.data;

    setMessages((prev) =>
      prev.length === list.length && prev[prev.length - 1]?._id === list[list.length - 1]?._id
        ? prev
        : list
    );

    if (list.some((m) => senderOf(m) === userId && !m.isRead)) {
      try {
        await API.post(`/messages/conversation/${userId}/read`);
      } catch (err) {
        // it will be marked on the next check
      }
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
      return;
    }

    let cancelled = false;

    const start = async () => {
      try {
        const [meRes, partnerRes] = await Promise.all([
          API.get('/auth/me'),
          API.get(`/messages/partner/${userId}`),
        ]);
        if (cancelled) return;
        setMe(meRes.data);
        setPartner(partnerRes.data);
        await fetchMessages();
      } catch (err: any) {
        if (!cancelled) setError(err.response?.data?.error || 'Could not open this conversation');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    start();

    const timer = setInterval(() => {
      if (document.hidden) return;
      fetchMessages().catch(() => {});
    }, 10000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (e?: any) => {
    if (e) e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      const res = await API.post('/messages', { receiverId: userId, content: text });
      setMessages((prev) => [...prev, res.data.data]);
      setDraft('');
    } catch (err: any) {
      if (err.response?.data?.code === 'BLOCKED_BY_ME') {
        setPartner((prev: any) => ({ ...prev, blockedByMe: true }));
      }
      toast.error(err.response?.data?.error || 'Could not send your message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: any) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleBlock = async () => {
    const ok = await confirmDialog({
      title: `Block ${partner.fullName}?`,
      message: 'Neither of you will be able to send messages to the other. You can unblock them any time.',
      confirmText: 'Block',
      danger: true,
    });
    if (!ok) return;

    setBlocking(true);
    try {
      await API.post(`/messages/block/${userId}`);
      setPartner((prev: any) => ({ ...prev, blockedByMe: true }));
      toast.success('Blocked');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not block this person');
    } finally {
      setBlocking(false);
    }
  };

  const handleUnblock = async () => {
    setBlocking(true);
    try {
      await API.delete(`/messages/block/${userId}`);
      setPartner((prev: any) => ({ ...prev, blockedByMe: false }));
      toast.success('Unblocked');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not unblock this person');
    } finally {
      setBlocking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
        Opening conversation...
      </div>
    );
  }

  if (error || !partner || !me) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <p className="text-gray-700">{error || 'Could not open this conversation'}</p>
        <Link href="/messages" className="text-blue-600 hover:underline">
          Back to messages
        </Link>
      </div>
    );
  }

  const myId = String(me._id);

  return (
    <div className="bg-gray-50">
      <div className="max-w-2xl mx-auto flex flex-col h-[calc(100dvh-4rem)] bg-white border-x border-gray-200">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <Link href="/messages" className="text-blue-600 hover:text-blue-700" aria-label="Back to messages">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          {partner.profileImage ? (
            <img src={partner.profileImage} alt={partner.fullName} className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 text-white flex items-center justify-center font-bold">
              {partner.fullName?.[0]?.toUpperCase() || 'U'}
            </div>
          )}
          <Link href={`/users/${partner._id}`} className="font-semibold text-black hover:underline truncate flex-1">
            {partner.fullName}
          </Link>
          {!partner.blockedByMe && (
            <button
              onClick={handleBlock}
              disabled={blocking}
              className="text-sm text-red-600 hover:underline disabled:text-gray-400"
            >
              Block
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 ? (
            <p className="text-center text-gray-500 text-sm mt-8">
              No messages yet. Say hello to {partner.fullName}.
            </p>
          ) : (
            messages.map((m: any) => {
              const mine = senderOf(m) === myId;
              return (
                <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      mine ? 'bg-blue-600 text-white' : 'bg-gray-100 text-black'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words text-sm">{m.content}</p>
                    <p className={`text-[10px] mt-1 ${mine ? 'text-blue-100' : 'text-gray-500'}`}>
                      {timeLabel(m.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {partner.blockedByMe ? (
          <div className="border-t border-gray-200 p-4 flex items-center justify-between gap-3 bg-gray-50">
            <p className="text-sm text-gray-700">You blocked this person. Unblock them to send a message.</p>
            <button
              onClick={handleUnblock}
              disabled={blocking}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 flex-shrink-0"
            >
              {blocking ? 'Please wait...' : 'Unblock'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="border-t border-gray-200 p-3 flex gap-2 items-end">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={MAX_LENGTH}
              placeholder="Write a message"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-black bg-white resize-none max-h-32"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400"
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}