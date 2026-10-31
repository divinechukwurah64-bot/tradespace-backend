'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import API from '@/lib/api';
import { toast } from '@/lib/dialogs';

const TOPICS = [
  'Payment problem',
  'Problem with an order',
  'My account',
  'Report a bug',
  'Suggestion',
  'Other',
];

export default function SupportPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [ready, setReady] = useState(false);
  const [supportEmail, setSupportEmail] = useState<string | null>(null);
  const [tickets, setTickets] = useState<any[]>([]);

  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const loadTickets = async () => {
    try {
      const response = await API.get('/support/tickets/mine');
      setTickets(response.data);
    } catch (err) {
      // not logged in
    }
  };

  useEffect(() => {
    const hasToken = !!localStorage.getItem('token');
    setLoggedIn(hasToken);
    setReady(true);

    const load = async () => {
      try {
        const info = await API.get('/support/info');
        setSupportEmail(info.data.email);
      } catch (err) {
        // the form still works
      }
      if (hasToken) await loadTickets();
    };
    load();
  }, []);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError('');
    setSending(true);

    try {
      await API.post('/support/tickets', { topic, message, link, name, email });
      setSent(true);
      setMessage('');
      setLink('');
      toast.success('Request sent');
      if (loggedIn) await loadTickets();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not send your request');
    } finally {
      setSending(false);
    }
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-black">Support</h1>
          <p className="text-gray-600 mt-2">
            Stuck or something went wrong? Check the{' '}
            <Link href="/help" className="text-blue-600 hover:underline">
              Help page
            </Link>{' '}
            first. If it does not answer your question, send us a request.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {supportEmail && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-700">You can also email us directly at</p>
            <a href={`mailto:${supportEmail}`} className="text-lg font-bold text-blue-600 hover:underline break-all">
              {supportEmail}
            </a>
          </div>
        )}

        {sent ? (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-6 mb-8">
            <p className="font-bold mb-1">Thanks. We have your request.</p>
            <p className="text-sm">
              {loggedIn
                ? 'We will reply here, and you will get a notification when we do.'
                : 'We will reply to the email you gave us.'}
            </p>
            <button onClick={() => setSent(false)} className="mt-3 text-sm text-green-800 underline">
              Send another request
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-bold text-black mb-4">Contact us</h2>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}

            {!loggedIn && (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:border-blue-500 text-black bg-white"
                />
                <label className="block text-sm font-medium text-gray-700 mb-2">Your email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="So we can reply to you"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:border-blue-500 text-black bg-white"
                />
              </>
            )}

            <label className="block text-sm font-medium text-gray-700 mb-2">Topic</label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:border-blue-500 text-black bg-white"
            >
              {TOPICS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <label className="block text-sm font-medium text-gray-700 mb-2">What happened?</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={5}
              maxLength={2000}
              placeholder="Tell us what went wrong and what you expected"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-black bg-white"
            />
            <p className="text-xs text-gray-500 mt-1 mb-4">{message.length}/2000</p>

            <label className="block text-sm font-medium text-gray-700 mb-2">Link to the auction (optional)</label>
            <input
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              maxLength={300}
              placeholder="Paste the address of the page"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-5 focus:outline-none focus:border-blue-500 text-black bg-white"
            />

            <button
              type="submit"
              disabled={sending}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400"
            >
              {sending ? 'Sending...' : 'Send request'}
            </button>
          </form>
        )}

        {loggedIn && tickets.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-black mb-4">Your requests</h2>
            <div className="space-y-4">
              {tickets.map((t) => (
                <div key={t._id} className="bg-white rounded-lg shadow p-5">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="font-semibold text-black">{t.topic}</p>
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full text-white ${
                        t.status === 'resolved' ? 'bg-green-600' : 'bg-yellow-500'
                      }`}
                    >
                      {t.status === 'resolved' ? 'Resolved' : 'Open'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{t.message}</p>
                  <p className="text-xs text-gray-500 mt-2">{new Date(t.createdAt).toLocaleString()}</p>
                  {t.adminNote && (
                    <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg p-3">
                      <p className="text-xs font-bold text-blue-700 mb-1">Reply from TradeSpace</p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{t.adminNote}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}