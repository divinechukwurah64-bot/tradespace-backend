'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import API, { authAPI } from '@/lib/api';
import { confirmDialog, toast } from '@/lib/dialogs';

type Tab = 'reports' | 'tickets';

export default function AdminInbox() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>('reports');
  const [showAll, setShowAll] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const status = showAll ? 'all' : 'open';
    const [r, t] = await Promise.all([
      API.get('/support/admin/reports', { params: { status } }),
      API.get('/support/admin/tickets', { params: { status } }),
    ]);
    setReports(r.data);
    setTickets(t.data);
  }, [showAll]);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.replace('/login');
        return;
      }
      try {
        const me = await authAPI.getMe();
        if (me.data?.role !== 'admin') {
          router.replace('/');
          return;
        }
        await load();
        setChecking(false);
      } catch (err: any) {
        if (err?.response?.status === 401) {
          router.replace('/login');
          return;
        }
        setError(err?.response?.data?.error || 'Could not load the inbox');
        setChecking(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (!checking) {
      load().catch(() => toast.error('Could not refresh the inbox'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAll]);

  const setReportStatus = async (id: string, status: string) => {
    await API.patch(`/support/admin/reports/${id}`, { status });
  };

  const decide = async (report: any, status: 'actioned' | 'dismissed' | 'open') => {
    try {
      await setReportStatus(report._id, status);
      toast.success('Report updated');
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not update the report');
    }
  };

  // Does something to the reported thing, then marks the report as actioned
  const act = async (report: any, title: string, message: string, danger: boolean, call: () => Promise<any>) => {
    const ok = await confirmDialog({ title, message, confirmText: 'Confirm', danger });
    if (!ok) return;
    try {
      await call();
      await setReportStatus(report._id, 'actioned');
      toast.success('Done');
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'That did not work');
    }
  };

  const updateTicket = async (ticket: any, body: { status?: string; adminNote?: string }) => {
    try {
      await API.patch(`/support/admin/tickets/${ticket._id}`, body);
      toast.success('Updated');
      setReplies((prev) => ({ ...prev, [ticket._id]: '' }));
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not update the request');
    }
  };

  if (checking) {
    return <div className="max-w-5xl mx-auto px-4 py-8 text-gray-600">Loading...</div>;
  }

  const statusColor = (s: string) =>
    s === 'open' ? 'bg-yellow-500' : s === 'actioned' || s === 'resolved' ? 'bg-green-600' : 'bg-gray-500';

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h1 className="text-3xl font-bold text-black">Inbox</h1>
        <Link href="/admin" className="text-blue-600 hover:underline text-sm">
          Back to admin panel
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setTab('reports')}
          className={`px-5 py-2 rounded-lg font-semibold border ${
            tab === 'reports' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-800 border-gray-300'
          }`}
        >
          Reports ({reports.length})
        </button>
        <button
          onClick={() => setTab('tickets')}
          className={`px-5 py-2 rounded-lg font-semibold border ${
            tab === 'tickets' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-800 border-gray-300'
          }`}
        >
          Support requests ({tickets.length})
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700 mb-4">
        <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
        Include ones already handled
      </label>

      {tab === 'reports' && (
        <div className="space-y-4">
          {reports.length === 0 && <p className="text-gray-500">No reports to show.</p>}

          {reports.map((r) => {
            const t = r.target || {};
            return (
              <div key={r._id} className="bg-white rounded-lg shadow p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-gray-800 text-white uppercase">
                      {r.targetType}
                    </span>
                    <span className="font-semibold text-black">{r.reason}</span>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full text-white ${statusColor(r.status)}`}>
                    {r.status}
                  </span>
                </div>

                <p className="text-sm text-gray-600">
                  Reported by {r.reporterId?.fullName || 'Unknown'} on {new Date(r.createdAt).toLocaleString()}
                </p>
                {r.note && <p className="text-sm text-gray-800 mt-2 break-words">Their note: {r.note}</p>}

                <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 mt-3 text-sm">
                  {t.exists === false ? (
                    <p className="text-gray-500">This no longer exists. It may already have been removed.</p>
                  ) : (
                    <>
                      <p className="font-semibold text-black break-words">{t.title}</p>
                      <p className="text-gray-600">
                        {t.owner ? `By ${t.owner}` : ''}
                        {t.owner && t.status ? ' - ' : ''}
                        {t.status ? `Status: ${t.status}` : ''}
                      </p>
                      {t.link && (
                        <a href={t.link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                          Open it
                        </a>
                      )}
                    </>
                  )}
                </div>

                {r.status === 'open' && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {t.exists !== false && r.targetType === 'comment' && (
                      <button
                        onClick={() =>
                          act(r, 'Delete this comment?', 'The comment is removed for good.', true, () =>
                            API.delete(`/support/admin/comments/${r.targetId}`)
                          )
                        }
                        className="bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-red-700"
                      >
                        Delete comment
                      </button>
                    )}

                    {t.exists !== false && r.targetType === 'auction' && (
                      <>
                        {t.status === 'active' && (
                          <button
                            onClick={() =>
                              act(r, 'End this auction?', `"${t.title}" ends now.`, false, () =>
                                API.patch(`/admin/auctions/${r.targetId}/end`)
                              )
                            }
                            className="bg-yellow-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-yellow-600"
                          >
                            End auction
                          </button>
                        )}
                        <button
                          onClick={() =>
                            act(r, 'Remove this auction?', `"${t.title}" is deleted for good.`, true, () =>
                              API.delete(`/admin/auctions/${r.targetId}`)
                            )
                          }
                          className="bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-red-700"
                        >
                          Remove auction
                        </button>
                      </>
                    )}

                    {t.exists !== false && r.targetType === 'gig' && (
                      <>
                        {t.status === 'active' && (
                          <button
                            onClick={() =>
                              act(r, 'Pause this gig?', `"${t.title}" is hidden until you reactivate it.`, false, () =>
                                API.patch(`/admin/gigs/${r.targetId}/status`)
                              )
                            }
                            className="bg-yellow-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-yellow-600"
                          >
                            Pause gig
                          </button>
                        )}
                        <button
                          onClick={() =>
                            act(r, 'Remove this gig?', `"${t.title}" is deleted for good.`, true, () =>
                              API.delete(`/admin/gigs/${r.targetId}`)
                            )
                          }
                          className="bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-red-700"
                        >
                          Remove gig
                        </button>
                      </>
                    )}

                    {t.exists !== false && r.targetType === 'user' && (
                      <button
                        onClick={() =>
                          act(
                            r,
                            t.status === 'banned' ? 'Unban this user?' : 'Ban this user?',
                            t.title,
                            t.status !== 'banned',
                            () => API.patch(`/admin/users/${r.targetId}/ban`)
                          )
                        }
                        className="bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-red-700"
                      >
                        {t.status === 'banned' ? 'Unban user' : 'Ban user'}
                      </button>
                    )}

                    <button
                      onClick={() => decide(r, 'actioned')}
                      className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-green-700"
                    >
                      Mark handled
                    </button>
                    <button
                      onClick={() => decide(r, 'dismissed')}
                      className="bg-white text-gray-700 border border-gray-300 px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-gray-50"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {r.status !== 'open' && (
                  <button
                    onClick={() => decide(r, 'open')}
                    className="mt-4 text-sm text-blue-600 hover:underline"
                  >
                    Reopen this report
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'tickets' && (
        <div className="space-y-4">
          {tickets.length === 0 && <p className="text-gray-500">No support requests to show.</p>}

          {tickets.map((t) => (
            <div key={t._id} className="bg-white rounded-lg shadow p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                <p className="font-semibold text-black">{t.topic}</p>
                <span className={`text-xs font-bold px-3 py-1 rounded-full text-white ${statusColor(t.status)}`}>
                  {t.status}
                </span>
              </div>

              <p className="text-sm text-gray-600">
                {t.name} -{' '}
                <a href={`mailto:${t.email}`} className="text-blue-600 hover:underline">
                  {t.email}
                </a>{' '}
                - {new Date(t.createdAt).toLocaleString()}
                {t.userId ? '' : ' (not logged in, so reply by email)'}
              </p>

              <p className="text-sm text-gray-900 mt-3 whitespace-pre-wrap break-words">{t.message}</p>
              {t.link && <p className="text-sm text-gray-600 mt-2 break-all">Link: {t.link}</p>}

              {t.adminNote && (
                <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <p className="text-xs font-bold text-blue-700 mb-1">Your reply</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{t.adminNote}</p>
                </div>
              )}

              <textarea
                value={replies[t._id] || ''}
                onChange={(e) => setReplies((prev) => ({ ...prev, [t._id]: e.target.value }))}
                rows={2}
                maxLength={1000}
                placeholder={t.userId ? 'Write a reply. They get it as a notification.' : 'Write a note for your records'}
                className="w-full mt-3 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
              />

              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  onClick={() => updateTicket(t, { adminNote: replies[t._id] || '', status: 'resolved' })}
                  disabled={!(replies[t._id] || '').trim()}
                  className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-green-700 disabled:bg-gray-400"
                >
                  Reply and resolve
                </button>
                {t.status === 'open' ? (
                  <button
                    onClick={() => updateTicket(t, { status: 'resolved' })}
                    className="bg-white text-gray-700 border border-gray-300 px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-gray-50"
                  >
                    Resolve without a reply
                  </button>
                ) : (
                  <button
                    onClick={() => updateTicket(t, { status: 'open' })}
                    className="bg-white text-gray-700 border border-gray-300 px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-gray-50"
                  >
                    Reopen
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}