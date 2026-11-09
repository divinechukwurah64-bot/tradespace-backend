'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Inbox as InboxIcon, ArrowLeft } from 'lucide-react';
import API, { authAPI } from '@/lib/api';
import { confirmDialog, toast } from '@/lib/dialogs';

type Tab = 'reports' | 'tickets';
type Tone = 'green' | 'amber' | 'gray';
type BtnTone = 'green' | 'amber' | 'red' | 'ghost';

const PANEL = 'bg-[#12121a] border border-white/10 rounded-2xl';

const toneClass: Record<Tone, string> = {
  green: 'bg-emerald-500/15 text-emerald-300',
  amber: 'bg-amber-500/15 text-amber-300',
  gray: 'bg-white/10 text-gray-300',
};

const btnClass: Record<BtnTone, string> = {
  green: 'bg-emerald-600 hover:bg-emerald-500 text-white',
  amber: 'bg-amber-600 hover:bg-amber-500 text-white',
  red: 'bg-red-600 hover:bg-red-500 text-white',
  ghost: 'bg-transparent border border-white/15 text-gray-200 hover:bg-white/5',
};

const statusTone = (status: string): Tone =>
  status === 'open' ? 'amber' : status === 'actioned' || status === 'resolved' ? 'green' : 'gray';

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${toneClass[tone]}`}>{children}</span>
  );
}

function Btn({
  tone,
  onClick,
  disabled,
  children,
}: {
  tone: BtnTone;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-1.5 rounded-lg text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed ${btnClass[tone]}`}
    >
      {children}
    </button>
  );
}

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
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#08080d] text-gray-300 flex items-center justify-center">
        Loading...
      </div>
    );
  }

  const navButton = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
      active ? 'bg-white text-black' : 'text-gray-400 hover:bg-white/5 hover:text-white'
    }`;

  const tabButton = (active: boolean) =>
    `px-5 py-2 rounded-xl font-semibold text-sm border transition ${
      active
        ? 'bg-white text-black border-white'
        : 'bg-[#12121a] text-gray-300 border-white/10 hover:bg-white/5'
    }`;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#08080d] text-gray-100 flex flex-col md:flex-row">
      {/* Sidebar: a row on phones, a column from tablet size up */}
      <aside className="md:w-56 md:flex-shrink-0 bg-[#0d0d14] border-b md:border-b-0 md:border-r border-white/10 p-3 md:p-4">
        <nav className="flex md:flex-col gap-1 overflow-x-auto md:h-full">
          <Link href="/admin" className={navButton(false)}>
            <LayoutDashboard className="w-4 h-4" />
            Admin panel
          </Link>
          <span className={navButton(true)}>
            <InboxIcon className="w-4 h-4" />
            Inbox
          </span>
          <Link href="/auctions" className={`${navButton(false)} md:mt-auto`}>
            <ArrowLeft className="w-4 h-4" />
            Back to site
          </Link>
        </nav>
      </aside>

      <main className="flex-1 min-w-0 p-4 md:p-8 max-w-5xl">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-6">Inbox</h1>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2 mb-4 flex-wrap">
          <button type="button" onClick={() => setTab('reports')} className={tabButton(tab === 'reports')}>
            Reports ({reports.length})
          </button>
          <button type="button" onClick={() => setTab('tickets')} className={tabButton(tab === 'tickets')}>
            Support requests ({tickets.length})
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-300 mb-4">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Include ones already handled
        </label>

        {tab === 'reports' && (
          <div className="space-y-4">
            {reports.length === 0 && <p className="text-gray-500">No reports to show.</p>}

            {reports.map((r) => {
              const t = r.target || {};
              return (
                <div key={r._id} className={`${PANEL} p-5`}>
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/10 text-gray-200 uppercase">
                        {r.targetType}
                      </span>
                      <span className="font-semibold text-white">{r.reason}</span>
                    </div>
                    <Pill tone={statusTone(r.status)}>{r.status}</Pill>
                  </div>

                  <p className="text-sm text-gray-400">
                    Reported by {r.reporterId?.fullName || 'Unknown'} on {new Date(r.createdAt).toLocaleString()}
                  </p>
                  {r.note && <p className="text-sm text-gray-200 mt-2 break-words">Their note: {r.note}</p>}

                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 mt-3 text-sm">
                    {t.exists === false ? (
                      <p className="text-gray-400">This no longer exists. It may already have been removed.</p>
                    ) : (
                      <>
                        <p className="font-semibold text-white break-words">{t.title}</p>
                        <p className="text-gray-400">
                          {t.owner ? `By ${t.owner}` : ''}
                          {t.owner && t.status ? ' - ' : ''}
                          {t.status ? `Status: ${t.status}` : ''}
                        </p>
                        {t.link && (
                          <a href={t.link} target="_blank" rel="noreferrer" className="text-blue-300 hover:underline">
                            Open it
                          </a>
                        )}
                      </>
                    )}
                  </div>

                  {r.status === 'open' && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {t.exists !== false && r.targetType === 'comment' && (
                        <Btn
                          tone="red"
                          onClick={() =>
                            act(r, 'Delete this comment?', 'The comment is removed for good.', true, () =>
                              API.delete(`/support/admin/comments/${r.targetId}`)
                            )
                          }
                        >
                          Delete comment
                        </Btn>
                      )}

                      {t.exists !== false && r.targetType === 'auction' && (
                        <>
                          {t.status === 'active' && (
                            <Btn
                              tone="amber"
                              onClick={() =>
                                act(r, 'End this auction?', `"${t.title}" ends now.`, false, () =>
                                  API.patch(`/admin/auctions/${r.targetId}/end`)
                                )
                              }
                            >
                              End auction
                            </Btn>
                          )}
                          <Btn
                            tone="red"
                            onClick={() =>
                              act(r, 'Remove this auction?', `"${t.title}" is deleted for good.`, true, () =>
                                API.delete(`/admin/auctions/${r.targetId}`)
                              )
                            }
                          >
                            Remove auction
                          </Btn>
                        </>
                      )}

                      {t.exists !== false && r.targetType === 'gig' && (
                        <>
                          {t.status === 'active' && (
                            <Btn
                              tone="amber"
                              onClick={() =>
                                act(r, 'Pause this gig?', `"${t.title}" is hidden until you reactivate it.`, false, () =>
                                  API.patch(`/admin/gigs/${r.targetId}/status`)
                                )
                              }
                            >
                              Pause gig
                            </Btn>
                          )}
                          <Btn
                            tone="red"
                            onClick={() =>
                              act(r, 'Remove this gig?', `"${t.title}" is deleted for good.`, true, () =>
                                API.delete(`/admin/gigs/${r.targetId}`)
                              )
                            }
                          >
                            Remove gig
                          </Btn>
                        </>
                      )}

                      {t.exists !== false && r.targetType === 'user' && (
                        <Btn
                          tone="red"
                          onClick={() =>
                            act(
                              r,
                              t.status === 'banned' ? 'Unban this user?' : 'Ban this user?',
                              t.title,
                              t.status !== 'banned',
                              () => API.patch(`/admin/users/${r.targetId}/ban`)
                            )
                          }
                        >
                          {t.status === 'banned' ? 'Unban user' : 'Ban user'}
                        </Btn>
                      )}

                      <Btn tone="green" onClick={() => decide(r, 'actioned')}>
                        Mark handled
                      </Btn>
                      <Btn tone="ghost" onClick={() => decide(r, 'dismissed')}>
                        Dismiss
                      </Btn>
                    </div>
                  )}

                  {r.status !== 'open' && (
                    <button
                      type="button"
                      onClick={() => decide(r, 'open')}
                      className="mt-4 text-sm text-blue-300 hover:underline"
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
              <div key={t._id} className={`${PANEL} p-5`}>
                <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                  <p className="font-semibold text-white">{t.topic}</p>
                  <Pill tone={statusTone(t.status)}>{t.status}</Pill>
                </div>

                <p className="text-sm text-gray-400">
                  {t.name} -{' '}
                  <a href={`mailto:${t.email}`} className="text-blue-300 hover:underline">
                    {t.email}
                  </a>{' '}
                  - {new Date(t.createdAt).toLocaleString()}
                  {t.userId ? '' : ' (not logged in, so reply by email)'}
                </p>

                <p className="text-sm text-gray-100 mt-3 whitespace-pre-wrap break-words">{t.message}</p>
                {t.link && <p className="text-sm text-gray-400 mt-2 break-all">Link: {t.link}</p>}

                {t.adminNote && (
                  <div className="mt-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                    <p className="text-xs font-bold text-blue-300 mb-1">Your reply</p>
                    <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">{t.adminNote}</p>
                  </div>
                )}

                <textarea
                  value={replies[t._id] || ''}
                  onChange={(e) => setReplies((prev) => ({ ...prev, [t._id]: e.target.value }))}
                  rows={2}
                  maxLength={1000}
                  placeholder={t.userId ? 'Write a reply. They get it as a notification.' : 'Write a note for your records'}
                  className="w-full mt-3 px-3 py-2 rounded-xl bg-[#0d0d14] border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />

                <div className="flex flex-wrap gap-2 mt-3">
                  <Btn
                    tone="green"
                    onClick={() => updateTicket(t, { adminNote: replies[t._id] || '', status: 'resolved' })}
                    disabled={!(replies[t._id] || '').trim()}
                  >
                    Reply and resolve
                  </Btn>
                  {t.status === 'open' ? (
                    <Btn tone="ghost" onClick={() => updateTicket(t, { status: 'resolved' })}>
                      Resolve without a reply
                    </Btn>
                  ) : (
                    <Btn tone="ghost" onClick={() => updateTicket(t, { status: 'open' })}>
                      Reopen
                    </Btn>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}app/admin/page.tsx