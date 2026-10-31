'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import API, { authAPI } from '../../lib/api';
import { confirmDialog, toast } from '../../lib/dialogs';

type Stats = {
  users?: number;
  bannedUsers?: number;
  activeAuctions?: number;
  totalAuctions?: number;
  totalGigs?: number;
  openDisputes?: number;
  failedPayouts?: number;
};

type AdminUser = {
  _id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: string;
  isBanned: boolean;
  paymentDefaults?: number;
  biddingBlocked?: boolean;
  createdAt: string;
};

type AdminAuction = {
  _id: string;
  title: string;
  status: string;
  startingBid: number;
  currentBid: number | null;
  endsAt: string;
  sellerId?: { fullName?: string; email?: string } | null;
};

type AdminGig = {
  _id: string;
  title: string;
  category: string;
  status: string;
  startingPrice: number;
  orders: number;
  createdAt: string;
  sellerId?: { fullName?: string; email?: string } | null;
};

type AdminTransaction = {
  _id: string;
  amount: number;
  sellerPayout: number;
  platformCommission: number;
  paymentStatus: string;
  payoutStatus: string;
  payoutError?: string;
  inspectionStatus: string;
  disputeStatus: string;
  disputeReason?: string;
  disputeNotes?: string;
  createdAt: string;
  buyerId?: { fullName?: string; email?: string } | null;
  sellerId?: { fullName?: string; email?: string } | null;
  auctionId?: { title?: string } | null;
  gigId?: { title?: string } | null;
};

type TabName = 'users' | 'auctions' | 'gigs' | 'transactions';

const s = {
  page: { maxWidth: 1200, margin: '0 auto', padding: '32px 16px', color: '#111827' } as React.CSSProperties,
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 } as React.CSSProperties,
  title: { fontSize: 28, fontWeight: 700, margin: 0 } as React.CSSProperties,
  inboxBtn: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, background: '#2563eb', color: '#ffffff', fontWeight: 700, textDecoration: 'none' } as React.CSSProperties,
  inboxBadge: { background: '#dc2626', color: '#ffffff', borderRadius: 999, padding: '1px 9px', fontSize: 13, fontWeight: 700 } as React.CSSProperties,
  statsRow: { display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 28 } as React.CSSProperties,
  statCard: { flex: '1 1 150px', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 } as React.CSSProperties,
  statNumber: { fontSize: 30, fontWeight: 700 } as React.CSSProperties,
  statLabel: { fontSize: 14, color: '#6b7280', marginTop: 4 } as React.CSSProperties,
  tabs: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' } as React.CSSProperties,
  tab: (active: boolean): React.CSSProperties => ({
    padding: '8px 18px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    background: active ? '#2563eb' : '#ffffff',
    color: active ? '#ffffff' : '#111827',
    cursor: 'pointer',
    fontWeight: 600,
  }),
  tableWrap: { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, overflowX: 'auto' } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 } as React.CSSProperties,
  th: { textAlign: 'left', padding: '12px 14px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' } as React.CSSProperties,
  td: { padding: '12px 14px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' } as React.CSSProperties,
  btn: (color: string): React.CSSProperties => ({
    padding: '6px 12px',
    borderRadius: 6,
    border: 'none',
    background: color,
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    marginRight: 6,
    marginBottom: 6,
    whiteSpace: 'nowrap',
  }),
  badge: (color: string): React.CSSProperties => ({
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 999,
    background: color,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 600,
  }),
  small: { fontSize: 12, color: '#6b7280', marginTop: 4, maxWidth: 260, wordBreak: 'break-word' } as React.CSSProperties,
  search: { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, width: 280, marginBottom: 12 } as React.CSSProperties,
  filterRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 14 } as React.CSSProperties,
  error: { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: 12, borderRadius: 8, marginBottom: 16 } as React.CSSProperties,
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 } as React.CSSProperties,
  modal: { background: '#ffffff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 480 } as React.CSSProperties,
  textarea: { width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, marginTop: 12, marginBottom: 16, fontFamily: 'inherit', fontSize: 14 } as React.CSSProperties,
};

const naira = (n: number | null | undefined) =>
  n === null || n === undefined ? '-' : `\u20A6${Number(n).toLocaleString()}`;

const formatDate = (d: string) => new Date(d).toLocaleString();

const paymentColor = (status: string) => {
  switch (status) {
    case 'released': return '#16a34a';
    case 'captured':
    case 'held': return '#2563eb';
    case 'refunded': return '#d97706';
    case 'failed': return '#dc2626';
    default: return '#6b7280';
  }
};

const payoutColor = (status: string) => {
  switch (status) {
    case 'paid': return '#16a34a';
    case 'processing':
    case 'queued': return '#2563eb';
    case 'failed': return '#dc2626';
    default: return '#6b7280';
  }
};

const disputeColor = (status: string) => {
  switch (status) {
    case 'filed': return '#dc2626';
    case 'resolved': return '#16a34a';
    default: return '#6b7280';
  }
};

export default function AdminPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<TabName>('users');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [auctions, setAuctions] = useState<AdminAuction[]>([]);
  const [gigs, setGigs] = useState<AdminGig[]>([]);
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [inboxCount, setInboxCount] = useState(0);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const [resolve, setResolve] = useState<{ tx: AdminTransaction; action: 'refund' | 'release' } | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [resolving, setResolving] = useState(false);

  const getErrorMessage = (err: any) =>
    err?.response?.data?.error || err?.message || 'Something went wrong';

  const loadStats = useCallback(async () => {
    const res = await API.get('/admin/stats');
    setStats(res.data);
  }, []);

  const loadUsers = useCallback(async (q: string) => {
    const res = await API.get('/admin/users', { params: q ? { search: q } : {} });
    setUsers(res.data);
  }, []);

  const loadAuctions = useCallback(async () => {
    const res = await API.get('/admin/auctions');
    setAuctions(res.data);
  }, []);

  const loadGigs = useCallback(async () => {
    const res = await API.get('/admin/gigs');
    setGigs(res.data);
  }, []);

  const loadTransactions = useCallback(async () => {
    const res = await API.get('/admin/transactions');
    setTransactions(res.data);
  }, []);

  // How many reports and support requests are waiting
  const loadInbox = useCallback(async () => {
    try {
      const [reports, tickets] = await Promise.all([
        API.get('/support/admin/reports', { params: { status: 'open' } }),
        API.get('/support/admin/tickets', { params: { status: 'open' } }),
      ]);
      setInboxCount(reports.data.length + tickets.data.length);
    } catch (err) {
      // the badge just stays as it was
    }
  }, []);

  // Check the user is a logged in admin, then load everything
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
        await Promise.all([
          loadStats(),
          loadUsers(''),
          loadAuctions(),
          loadGigs(),
          loadTransactions(),
          loadInbox(),
        ]);
        setChecking(false);
      } catch (err: any) {
        if (err?.response?.status === 401) {
          router.replace('/login');
          return;
        }
        setError(getErrorMessage(err));
        setChecking(false);
      }
    };
    init();
  }, [router, loadStats, loadUsers, loadAuctions, loadGigs, loadTransactions, loadInbox]);

  // Keep the inbox badge fresh
  useEffect(() => {
    if (checking) return;
    const interval = setInterval(loadInbox, 60000);
    return () => clearInterval(interval);
  }, [checking, loadInbox]);

  const handleSearch = async (value: string) => {
    setSearch(value);
    try {
      await loadUsers(value);
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    }
  };

  const toggleBan = async (user: AdminUser) => {
    const ok = await confirmDialog({
      title: user.isBanned ? 'Unban this user?' : 'Ban this user?',
      message: user.fullName,
      confirmText: user.isBanned ? 'Unban' : 'Ban',
      danger: !user.isBanned,
    });
    if (!ok) return;
    try {
      await API.patch(`/admin/users/${user._id}/ban`);
      toast.success(user.isBanned ? 'User unbanned' : 'User banned');
      await Promise.all([loadUsers(search), loadStats()]);
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    }
  };

  const unblockBidding = async (user: AdminUser) => {
    const ok = await confirmDialog({
      title: 'Let this user bid again?',
      message: `${user.fullName} has ${user.paymentDefaults || 0} unpaid-win strikes. This clears them.`,
      confirmText: 'Unblock bidding',
    });
    if (!ok) return;
    try {
      await API.patch(`/admin/users/${user._id}/unblock-bidding`);
      toast.success('Bidding unblocked');
      await loadUsers(search);
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    }
  };

  const endAuction = async (auction: AdminAuction) => {
    const ok = await confirmDialog({
      title: 'End this auction now?',
      message: auction.title,
      confirmText: 'End auction',
    });
    if (!ok) return;
    try {
      await API.patch(`/admin/auctions/${auction._id}/end`);
      toast.success('Auction ended');
      await Promise.all([loadAuctions(), loadStats()]);
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    }
  };

  const removeAuction = async (auction: AdminAuction) => {
    const ok = await confirmDialog({
      title: 'Remove this auction?',
      message: `"${auction.title}" will be deleted for good.`,
      confirmText: 'Remove',
      danger: true,
    });
    if (!ok) return;
    try {
      await API.delete(`/admin/auctions/${auction._id}`);
      toast.success('Auction removed');
      await Promise.all([loadAuctions(), loadStats()]);
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    }
  };

  const toggleGig = async (gig: AdminGig) => {
    const action = gig.status === 'active' ? 'Pause' : 'Reactivate';
    const ok = await confirmDialog({
      title: `${action} this gig?`,
      message: gig.title,
      confirmText: action,
    });
    if (!ok) return;
    try {
      await API.patch(`/admin/gigs/${gig._id}/status`);
      toast.success('Gig updated');
      await loadGigs();
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    }
  };

  const removeGig = async (gig: AdminGig) => {
    const ok = await confirmDialog({
      title: 'Remove this gig?',
      message: `"${gig.title}" will be deleted for good.`,
      confirmText: 'Remove',
      danger: true,
    });
    if (!ok) return;
    try {
      await API.delete(`/admin/gigs/${gig._id}`);
      toast.success('Gig removed');
      await Promise.all([loadGigs(), loadStats()]);
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    }
  };

  const itemTitle = (t: AdminTransaction) => t.auctionId?.title || t.gigId?.title || 'Unknown item';

  const openResolve = (tx: AdminTransaction, action: 'refund' | 'release') => {
    setResolveNote('');
    setResolve({ tx, action });
  };

  const submitResolve = async () => {
    if (!resolve) return;
    setResolving(true);
    try {
      await API.post(`/admin/transactions/${resolve.tx._id}/${resolve.action}`, { note: resolveNote });
      toast.success(resolve.action === 'refund' ? 'The buyer is being refunded' : 'The seller payout has started');
      setResolve(null);
      setResolveNote('');
      await Promise.all([loadTransactions(), loadStats()]);
    } catch (err: any) {
      toast.error(getErrorMessage(err));
      await loadTransactions();
    } finally {
      setResolving(false);
    }
  };

  const retryPayout = async (tx: AdminTransaction) => {
    const ok = await confirmDialog({
      title: 'Retry this payout?',
      message: `Send ${naira(tx.sellerPayout)} to the seller for "${itemTitle(tx)}" again.`,
      confirmText: 'Retry payout',
    });
    if (!ok) return;
    try {
      const response = await API.post(`/admin/transactions/${tx._id}/release`, { note: '' });
      if (response.data.payoutStatus === 'paid' || response.data.paymentStatus === 'released') {
        toast.success('The seller has been paid');
      } else if (response.data.payoutError) {
        toast.error(`Payout not sent yet: ${response.data.payoutError}`);
      } else {
        toast.info('The payout was started and will update shortly');
      }
      await Promise.all([loadTransactions(), loadStats()]);
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    }
  };

  if (checking) {
    return (
      <div style={s.page}>
        <p>Loading admin panel...</p>
      </div>
    );
  }

  const needsAttention = (t: AdminTransaction) =>
    t.disputeStatus === 'filed' || t.payoutStatus === 'failed' || t.paymentStatus === 'captured';

  const visibleTransactions = attentionOnly ? transactions.filter(needsAttention) : transactions;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Admin Panel</h1>
        <Link href="/admin/inbox" style={s.inboxBtn}>
          Inbox
          {inboxCount > 0 && <span style={s.inboxBadge}>{inboxCount}</span>}
        </Link>
      </div>

      {error && <div style={s.error}>{error}</div>}

      {stats && (
        <div style={s.statsRow}>
          <div style={s.statCard}>
            <div style={s.statNumber}>{stats.users ?? 0}</div>
            <div style={s.statLabel}>Total users</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statNumber}>{stats.bannedUsers ?? 0}</div>
            <div style={s.statLabel}>Banned users</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statNumber}>{stats.activeAuctions ?? 0}</div>
            <div style={s.statLabel}>Active auctions</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statNumber}>{stats.totalAuctions ?? 0}</div>
            <div style={s.statLabel}>Total auctions</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statNumber}>{stats.totalGigs ?? 0}</div>
            <div style={s.statLabel}>Total gigs</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statNumber}>{stats.openDisputes ?? 0}</div>
            <div style={s.statLabel}>Open disputes</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statNumber}>{stats.failedPayouts ?? 0}</div>
            <div style={s.statLabel}>Failed payouts</div>
          </div>
        </div>
      )}

      <div style={s.tabs}>
        <button style={s.tab(tab === 'users')} onClick={() => setTab('users')}>
          Users
        </button>
        <button style={s.tab(tab === 'auctions')} onClick={() => setTab('auctions')}>
          Auctions
        </button>
        <button style={s.tab(tab === 'gigs')} onClick={() => setTab('gigs')}>
          Gigs
        </button>
        <button style={s.tab(tab === 'transactions')} onClick={() => setTab('transactions')}>
          Transactions
        </button>
      </div>

      {tab === 'users' && (
        <>
          <input
            style={s.search}
            type="text"
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Name</th>
                  <th style={s.th}>Email</th>
                  <th style={s.th}>Phone</th>
                  <th style={s.th}>Role</th>
                  <th style={s.th}>Status</th>
                  <th style={s.th}>Strikes</th>
                  <th style={s.th}>Joined</th>
                  <th style={s.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td style={s.td} colSpan={8}>No users found</td>
                  </tr>
                )}
                {users.map((u) => (
                  <tr key={u._id}>
                    <td style={s.td}>{u.fullName}</td>
                    <td style={s.td}>{u.email}</td>
                    <td style={s.td}>{u.phone || '-'}</td>
                    <td style={s.td}>{u.role}</td>
                    <td style={s.td}>
                      {u.isBanned ? (
                        <span style={s.badge('#dc2626')}>Banned</span>
                      ) : (
                        <span style={s.badge('#16a34a')}>Active</span>
                      )}
                      {u.biddingBlocked && (
                        <div style={{ marginTop: 6 }}>
                          <span style={s.badge('#d97706')}>Bidding blocked</span>
                        </div>
                      )}
                    </td>
                    <td style={s.td}>{u.paymentDefaults || 0} of 3</td>
                    <td style={s.td}>{formatDate(u.createdAt)}</td>
                    <td style={s.td}>
                      {u.role !== 'admin' && (
                        <button
                          style={s.btn(u.isBanned ? '#16a34a' : '#dc2626')}
                          onClick={() => toggleBan(u)}
                        >
                          {u.isBanned ? 'Unban' : 'Ban'}
                        </button>
                      )}
                      {(u.biddingBlocked || (u.paymentDefaults || 0) > 0) && (
                        <button style={s.btn('#2563eb')} onClick={() => unblockBidding(u)}>
                          Unblock bidding
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'auctions' && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Title</th>
                <th style={s.th}>Seller</th>
                <th style={s.th}>Starting bid</th>
                <th style={s.th}>Current bid</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Ends</th>
                <th style={s.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {auctions.length === 0 && (
                <tr>
                  <td style={s.td} colSpan={7}>No auctions found</td>
                </tr>
              )}
              {auctions.map((a) => (
                <tr key={a._id}>
                  <td style={s.td}>{a.title}</td>
                  <td style={s.td}>{a.sellerId?.fullName || 'Unknown'}</td>
                  <td style={s.td}>{naira(a.startingBid)}</td>
                  <td style={s.td}>{naira(a.currentBid)}</td>
                  <td style={s.td}>
                    <span
                      style={s.badge(
                        a.status === 'active'
                          ? '#16a34a'
                          : a.status === 'sold'
                          ? '#2563eb'
                          : a.status === 'awaiting_payment'
                          ? '#d97706'
                          : '#6b7280'
                      )}
                    >
                      {a.status === 'awaiting_payment' ? 'awaiting payment' : a.status}
                    </span>
                  </td>
                  <td style={s.td}>{formatDate(a.endsAt)}</td>
                  <td style={s.td}>
                    {a.status === 'active' && (
                      <button style={s.btn('#d97706')} onClick={() => endAuction(a)}>
                        End
                      </button>
                    )}
                    <button style={s.btn('#dc2626')} onClick={() => removeAuction(a)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'gigs' && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Title</th>
                <th style={s.th}>Seller</th>
                <th style={s.th}>Category</th>
                <th style={s.th}>Price</th>
                <th style={s.th}>Orders</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Created</th>
                <th style={s.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {gigs.length === 0 && (
                <tr>
                  <td style={s.td} colSpan={8}>No gigs found</td>
                </tr>
              )}
              {gigs.map((g) => (
                <tr key={g._id}>
                  <td style={s.td}>{g.title}</td>
                  <td style={s.td}>{g.sellerId?.fullName || 'Unknown'}</td>
                  <td style={s.td}>{g.category}</td>
                  <td style={s.td}>{naira(g.startingPrice)}</td>
                  <td style={s.td}>{g.orders}</td>
                  <td style={s.td}>
                    <span
                      style={s.badge(
                        g.status === 'active' ? '#16a34a' : g.status === 'paused' ? '#d97706' : '#6b7280'
                      )}
                    >
                      {g.status}
                    </span>
                  </td>
                  <td style={s.td}>{formatDate(g.createdAt)}</td>
                  <td style={s.td}>
                    {g.status !== 'completed' && (
                      <button
                        style={s.btn(g.status === 'active' ? '#d97706' : '#16a34a')}
                        onClick={() => toggleGig(g)}
                      >
                        {g.status === 'active' ? 'Pause' : 'Reactivate'}
                      </button>
                    )}
                    <button style={s.btn('#dc2626')} onClick={() => removeGig(g)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'transactions' && (
        <>
          <label style={s.filterRow}>
            <input
              type="checkbox"
              checked={attentionOnly}
              onChange={(e) => setAttentionOnly(e.target.checked)}
            />
            Show only payments that need attention (disputes, failed payouts, manual refunds)
          </label>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Item</th>
                  <th style={s.th}>Buyer</th>
                  <th style={s.th}>Seller</th>
                  <th style={s.th}>Amount</th>
                  <th style={s.th}>Seller gets</th>
                  <th style={s.th}>Payment</th>
                  <th style={s.th}>Payout</th>
                  <th style={s.th}>Dispute</th>
                  <th style={s.th}>Date</th>
                  <th style={s.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleTransactions.length === 0 && (
                  <tr>
                    <td style={s.td} colSpan={10}>No transactions found</td>
                  </tr>
                )}
                {visibleTransactions.map((t) => {
                  const canResolve =
                    t.paymentStatus === 'held' && (t.payoutStatus === 'none' || t.payoutStatus === 'failed');
                  const needsManualRefund = t.paymentStatus === 'captured';

                  return (
                    <tr key={t._id}>
                      <td style={s.td}>{itemTitle(t)}</td>
                      <td style={s.td}>{t.buyerId?.fullName || 'Unknown'}</td>
                      <td style={s.td}>{t.sellerId?.fullName || 'Unknown'}</td>
                      <td style={s.td}>{naira(t.amount)}</td>
                      <td style={s.td}>{naira(t.sellerPayout)}</td>
                      <td style={s.td}>
                        <span style={s.badge(paymentColor(t.paymentStatus))}>{t.paymentStatus}</span>
                      </td>
                      <td style={s.td}>
                        <span style={s.badge(payoutColor(t.payoutStatus))}>{t.payoutStatus}</span>
                        {t.payoutError && <div style={s.small}>{t.payoutError}</div>}
                      </td>
                      <td style={s.td}>
                        <span style={s.badge(disputeColor(t.disputeStatus))}>{t.disputeStatus}</span>
                        {t.disputeReason && <div style={s.small}>{t.disputeReason}</div>}
                        {t.disputeNotes && <div style={s.small}>{t.disputeNotes}</div>}
                      </td>
                      <td style={s.td}>{formatDate(t.createdAt)}</td>
                      <td style={s.td}>
                        {canResolve && (
                          <>
                            <button style={s.btn('#dc2626')} onClick={() => openResolve(t, 'refund')}>
                              Refund buyer
                            </button>
                            {t.payoutStatus === 'failed' ? (
                              <button style={s.btn('#2563eb')} onClick={() => retryPayout(t)}>
                                Retry payout
                              </button>
                            ) : (
                              <button style={s.btn('#16a34a')} onClick={() => openResolve(t, 'release')}>
                                Pay seller
                              </button>
                            )}
                          </>
                        )}
                        {needsManualRefund && (
                          <button style={s.btn('#dc2626')} onClick={() => openResolve(t, 'refund')}>
                            Refund buyer
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {resolve && (
        <div style={s.overlay} onClick={() => !resolving && setResolve(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              {resolve.action === 'refund' ? 'Refund the buyer?' : 'Pay the seller?'}
            </h2>
            <p style={{ fontSize: 14, color: '#374151' }}>
              {resolve.action === 'refund'
                ? `${naira(resolve.tx.amount)} goes back to ${resolve.tx.buyerId?.fullName || 'the buyer'}, and "${itemTitle(
                    resolve.tx
                  )}" returns to the seller as expired.`
                : `${naira(resolve.tx.sellerPayout)} is sent to ${resolve.tx.sellerId?.fullName || 'the seller'}.`}
            </p>
            {resolve.tx.disputeReason && (
              <p style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>
                Buyer reported: {resolve.tx.disputeReason}
                {resolve.tx.disputeNotes ? ` - ${resolve.tx.disputeNotes}` : ''}
              </p>
            )}
            <textarea
              style={s.textarea}
              rows={3}
              maxLength={500}
              placeholder="Note for both people (optional)"
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                onClick={() => setResolve(null)}
                disabled={resolving}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: '1px solid #d1d5db',
                  background: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                onClick={submitResolve}
                disabled={resolving}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: resolve.action === 'refund' ? '#dc2626' : '#16a34a',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: 700,
                  opacity: resolving ? 0.6 : 1,
                }}
              >
                {resolving ? 'Working...' : resolve.action === 'refund' ? 'Refund buyer' : 'Pay seller'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}