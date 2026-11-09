'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Users, Gavel, Briefcase, CreditCard, Inbox, ArrowLeft, ArrowUpRight } from 'lucide-react';
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
  disputeOpenedAt?: string | null;
  sellerComplaintReason?: string;
  sellerComplaintNote?: string;
  sellerComplaintAt?: string | null;
  createdAt: string;
  buyerId?: { fullName?: string; email?: string } | null;
  sellerId?: { fullName?: string; email?: string } | null;
  auctionId?: { title?: string } | null;
  gigId?: { title?: string } | null;
};

type TabName = 'overview' | 'users' | 'auctions' | 'gigs' | 'transactions';
type Tone = 'green' | 'blue' | 'amber' | 'red' | 'gray';

const TAB_TITLES: Record<TabName, string> = {
  overview: 'Overview',
  users: 'Users',
  auctions: 'Auctions',
  gigs: 'Gigs',
  transactions: 'Transactions',
};

const toneClass: Record<Tone, string> = {
  green: 'bg-emerald-500/15 text-emerald-300',
  blue: 'bg-blue-500/15 text-blue-300',
  amber: 'bg-amber-500/15 text-amber-300',
  red: 'bg-red-500/15 text-red-300',
  gray: 'bg-white/10 text-gray-300',
};

const btnClass: Record<'green' | 'blue' | 'amber' | 'red', string> = {
  green: 'bg-emerald-600 hover:bg-emerald-500 text-white',
  blue: 'bg-blue-600 hover:bg-blue-500 text-white',
  amber: 'bg-amber-600 hover:bg-amber-500 text-white',
  red: 'bg-red-600 hover:bg-red-500 text-white',
};

const PANEL = 'bg-[#12121a] border border-white/10 rounded-2xl';
const TH =
  'text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 border-b border-white/10 whitespace-nowrap';
const TD = 'px-4 py-3 border-b border-white/5 align-top text-sm text-gray-200';
const SMALL = 'text-xs text-gray-400 mt-1 max-w-[260px] break-words';

const naira = (n: number | null | undefined) =>
  n === null || n === undefined ? '-' : `\u20A6${Number(n).toLocaleString()}`;

const formatDate = (d: string) => new Date(d).toLocaleString();

const paymentTone = (status: string): Tone => {
  switch (status) {
    case 'released': return 'green';
    case 'captured':
    case 'held': return 'blue';
    case 'refunded': return 'amber';
    case 'failed': return 'red';
    default: return 'gray';
  }
};

const payoutTone = (status: string): Tone => {
  switch (status) {
    case 'paid': return 'green';
    case 'processing':
    case 'queued': return 'blue';
    case 'failed': return 'red';
    default: return 'gray';
  }
};

const disputeTone = (status: string): Tone => {
  switch (status) {
    case 'filed': return 'red';
    case 'resolved': return 'green';
    default: return 'gray';
  }
};

const auctionTone = (status: string): Tone => {
  switch (status) {
    case 'active': return 'green';
    case 'sold': return 'blue';
    case 'awaiting_payment': return 'amber';
    default: return 'gray';
  }
};

const gigTone = (status: string): Tone => {
  switch (status) {
    case 'active': return 'green';
    case 'paused': return 'amber';
    default: return 'gray';
  }
};

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${toneClass[tone]}`}>
      {children}
    </span>
  );
}

function Btn({
  tone,
  onClick,
  disabled,
  children,
}: {
  tone: 'green' | 'blue' | 'amber' | 'red';
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold mr-2 mb-2 whitespace-nowrap disabled:opacity-50 ${btnClass[tone]}`}
    >
      {children}
    </button>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 ${
        highlight ? 'bg-white text-black' : 'bg-[#12121a] border border-white/10 text-white'
      }`}
    >
      <p className={`text-sm ${highlight ? 'text-gray-600' : 'text-gray-400'}`}>{label}</p>
      <p className="text-2xl md:text-3xl font-bold mt-2 break-words">{value}</p>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<TabName>('overview');
  const [adminName, setAdminName] = useState('');
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
        setAdminName(me.data?.fullName || '');
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

  const goToAttention = () => {
    setAttentionOnly(true);
    setTab('transactions');
  };

  if (checking) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#08080d] text-gray-300 flex items-center justify-center">
        Loading admin panel...
      </div>
    );
  }

  const needsAttention = (t: AdminTransaction) =>
    t.disputeStatus === 'filed' || t.payoutStatus === 'failed' || t.paymentStatus === 'captured';

  const visibleTransactions = attentionOnly ? transactions.filter(needsAttention) : transactions;

  // Figures worked out from the transactions loaded above
  const paidTransactions = transactions.filter(
    (t) => t.paymentStatus === 'held' || t.paymentStatus === 'released'
  );
  const totalSales = paidTransactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const commissionEarned = paidTransactions.reduce((sum, t) => sum + Number(t.platformCommission || 0), 0);
  const attentionCount = transactions.filter(needsAttention).length;
  const manualRefundCount = transactions.filter((t) => t.paymentStatus === 'captured').length;

  // Paid sales per day for the last 14 days
  const chartDays = Array.from({ length: 14 }, (_, index) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (13 - index));
    return day;
  });

  const chartData = chartDays.map((day) => {
    const key = day.toDateString();
    const value = paidTransactions
      .filter((t) => new Date(t.createdAt).toDateString() === key)
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    return {
      value,
      label: day.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    };
  });

  const chartMax = Math.max(...chartData.map((d) => d.value), 1);

  const latestTransactions = [...transactions]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const firstName = adminName.split(' ')[0] || 'Admin';

  const navItems: { key: TabName; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { key: 'transactions', label: 'Transactions', icon: <CreditCard className="w-4 h-4" /> },
    { key: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
    { key: 'auctions', label: 'Auctions', icon: <Gavel className="w-4 h-4" /> },
    { key: 'gigs', label: 'Gigs', icon: <Briefcase className="w-4 h-4" /> },
  ];

  const navButton = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
      active ? 'bg-white text-black' : 'text-gray-400 hover:bg-white/5 hover:text-white'
    }`;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#08080d] text-gray-100 flex flex-col md:flex-row">
      {/* Sidebar: a row on phones, a column from tablet size up */}
      <aside className="md:w-56 md:flex-shrink-0 bg-[#0d0d14] border-b md:border-b-0 md:border-r border-white/10 p-3 md:p-4">
        <nav className="flex md:flex-col gap-1 overflow-x-auto md:h-full">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={navButton(tab === item.key)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}

          <Link href="/admin/inbox" className={navButton(false)}>
            <Inbox className="w-4 h-4" />
            Inbox
            {inboxCount > 0 && (
              <span className="bg-red-600 text-white rounded-full px-2 text-xs font-bold">{inboxCount}</span>
            )}
          </Link>

          <Link href="/auctions" className={`${navButton(false)} md:mt-auto`}>
            <ArrowLeft className="w-4 h-4" />
            Back to site
          </Link>
        </nav>
      </aside>

      <main className="flex-1 min-w-0 p-4 md:p-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            {tab === 'overview' ? `Hello, ${firstName}` : TAB_TITLES[tab]}
          </h1>
          {tab === 'overview' && (
            <p className="text-sm text-gray-400 mt-1">Here is what is happening on TradeSpace.</p>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <StatCard label="Total sales" value={naira(totalSales)} highlight />
              <StatCard label="Commission earned" value={naira(Math.round(commissionEarned))} />
              <StatCard label="Paid orders" value={paidTransactions.length} />
              <StatCard label="Active auctions" value={stats?.activeAuctions ?? 0} />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard label="Total users" value={stats?.users ?? 0} />
              <StatCard label="Banned users" value={stats?.bannedUsers ?? 0} />
              <StatCard label="Total auctions" value={stats?.totalAuctions ?? 0} />
              <StatCard label="Total gigs" value={stats?.totalGigs ?? 0} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              <div className={`${PANEL} p-5 lg:col-span-2`}>
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="font-bold text-white">Sales, last 14 days</h2>
                  <span className="text-xs text-gray-400">Paid and held orders</span>
                </div>
                <div className="flex items-end gap-1.5 h-48">
                  {chartData.map((d, index) => (
                    <div key={index} className="flex-1 min-w-0 h-full flex flex-col justify-end items-center">
                      <div
                        title={`${d.label}: ${naira(d.value)}`}
                        className="w-full rounded-t-md bg-blue-500 hover:bg-blue-400 transition"
                        style={{ height: d.value > 0 ? `${Math.max((d.value / chartMax) * 100, 3)}%` : '2px', opacity: d.value > 0 ? 1 : 0.25 }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-1.5 mt-2">
                  {chartData.map((d, index) => (
                    <div key={index} className="flex-1 min-w-0 text-center text-[10px] text-gray-500">
                      {index % 2 === 0 ? d.label : ''}
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${PANEL} p-5 flex flex-col`}>
                <h2 className="font-bold text-white mb-4">Needs your attention</h2>
                <div className="space-y-3 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Open disputes</span>
                    <Pill tone={(stats?.openDisputes ?? 0) > 0 ? 'red' : 'gray'}>{stats?.openDisputes ?? 0}</Pill>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Failed payouts</span>
                    <Pill tone={(stats?.failedPayouts ?? 0) > 0 ? 'red' : 'gray'}>{stats?.failedPayouts ?? 0}</Pill>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Manual refunds waiting</span>
                    <Pill tone={manualRefundCount > 0 ? 'red' : 'gray'}>{manualRefundCount}</Pill>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Inbox (reports and support)</span>
                    <Pill tone={inboxCount > 0 ? 'amber' : 'gray'}>{inboxCount}</Pill>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={goToAttention}
                  className="mt-5 inline-flex items-center justify-center gap-2 bg-white text-black rounded-xl py-2 text-sm font-semibold hover:bg-gray-200"
                >
                  {attentionCount} to review
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className={`${PANEL} overflow-hidden`}>
              <div className="flex items-center justify-between px-5 py-4">
                <h2 className="font-bold text-white">Latest transactions</h2>
                <button
                  type="button"
                  onClick={() => {
                    setAttentionOnly(false);
                    setTab('transactions');
                  }}
                  className="text-sm text-blue-300 hover:underline"
                >
                  See all
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={TH}>Item</th>
                      <th className={TH}>Buyer</th>
                      <th className={TH}>Amount</th>
                      <th className={TH}>Payment</th>
                      <th className={TH}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestTransactions.length === 0 && (
                      <tr>
                        <td className={TD} colSpan={5}>No transactions yet</td>
                      </tr>
                    )}
                    {latestTransactions.map((t) => (
                      <tr key={t._id}>
                        <td className={TD}>{itemTitle(t)}</td>
                        <td className={TD}>{t.buyerId?.fullName || 'Unknown'}</td>
                        <td className={TD}>{naira(t.amount)}</td>
                        <td className={TD}>
                          <Pill tone={paymentTone(t.paymentStatus)}>{t.paymentStatus}</Pill>
                        </td>
                        <td className={TD}>{formatDate(t.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === 'users' && (
          <>
            <input
              className="px-4 py-2 mb-4 w-full max-w-sm rounded-xl bg-[#12121a] border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              type="text"
              placeholder="Search by name or email"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
            <div className={`${PANEL} overflow-x-auto`}>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={TH}>Name</th>
                    <th className={TH}>Email</th>
                    <th className={TH}>Phone</th>
                    <th className={TH}>Role</th>
                    <th className={TH}>Status</th>
                    <th className={TH}>Strikes</th>
                    <th className={TH}>Joined</th>
                    <th className={TH}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr>
                      <td className={TD} colSpan={8}>No users found</td>
                    </tr>
                  )}
                  {users.map((u) => (
                    <tr key={u._id}>
                      <td className={TD}>{u.fullName}</td>
                      <td className={TD}>{u.email}</td>
                      <td className={TD}>{u.phone || '-'}</td>
                      <td className={TD}>{u.role}</td>
                      <td className={TD}>
                        {u.isBanned ? <Pill tone="red">Banned</Pill> : <Pill tone="green">Active</Pill>}
                        {u.biddingBlocked && (
                          <div className="mt-1.5">
                            <Pill tone="amber">Bidding blocked</Pill>
                          </div>
                        )}
                      </td>
                      <td className={TD}>{u.paymentDefaults || 0} of 3</td>
                      <td className={TD}>{formatDate(u.createdAt)}</td>
                      <td className={TD}>
                        {u.role !== 'admin' && (
                          <Btn tone={u.isBanned ? 'green' : 'red'} onClick={() => toggleBan(u)}>
                            {u.isBanned ? 'Unban' : 'Ban'}
                          </Btn>
                        )}
                        {(u.biddingBlocked || (u.paymentDefaults || 0) > 0) && (
                          <Btn tone="blue" onClick={() => unblockBidding(u)}>
                            Unblock bidding
                          </Btn>
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
          <div className={`${PANEL} overflow-x-auto`}>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={TH}>Title</th>
                  <th className={TH}>Seller</th>
                  <th className={TH}>Starting bid</th>
                  <th className={TH}>Current bid</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Ends</th>
                  <th className={TH}>Action</th>
                </tr>
              </thead>
              <tbody>
                {auctions.length === 0 && (
                  <tr>
                    <td className={TD} colSpan={7}>No auctions found</td>
                  </tr>
                )}
                {auctions.map((a) => (
                  <tr key={a._id}>
                    <td className={TD}>{a.title}</td>
                    <td className={TD}>{a.sellerId?.fullName || 'Unknown'}</td>
                    <td className={TD}>{naira(a.startingBid)}</td>
                    <td className={TD}>{naira(a.currentBid)}</td>
                    <td className={TD}>
                      <Pill tone={auctionTone(a.status)}>
                        {a.status === 'awaiting_payment' ? 'awaiting payment' : a.status}
                      </Pill>
                    </td>
                    <td className={TD}>{formatDate(a.endsAt)}</td>
                    <td className={TD}>
                      {a.status === 'active' && (
                        <Btn tone="amber" onClick={() => endAuction(a)}>
                          End
                        </Btn>
                      )}
                      {a.status === 'sold' ? (
                        <div className={SMALL}>Handle this sale from the Transactions tab</div>
                      ) : (
                        <Btn tone="red" onClick={() => removeAuction(a)}>
                          Remove
                        </Btn>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'gigs' && (
          <div className={`${PANEL} overflow-x-auto`}>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={TH}>Title</th>
                  <th className={TH}>Seller</th>
                  <th className={TH}>Category</th>
                  <th className={TH}>Price</th>
                  <th className={TH}>Orders</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Created</th>
                  <th className={TH}>Action</th>
                </tr>
              </thead>
              <tbody>
                {gigs.length === 0 && (
                  <tr>
                    <td className={TD} colSpan={8}>No gigs found</td>
                  </tr>
                )}
                {gigs.map((g) => (
                  <tr key={g._id}>
                    <td className={TD}>{g.title}</td>
                    <td className={TD}>{g.sellerId?.fullName || 'Unknown'}</td>
                    <td className={TD}>{g.category}</td>
                    <td className={TD}>{naira(g.startingPrice)}</td>
                    <td className={TD}>{g.orders}</td>
                    <td className={TD}>
                      <Pill tone={gigTone(g.status)}>{g.status}</Pill>
                    </td>
                    <td className={TD}>{formatDate(g.createdAt)}</td>
                    <td className={TD}>
                      {g.status !== 'completed' && (
                        <Btn tone={g.status === 'active' ? 'amber' : 'green'} onClick={() => toggleGig(g)}>
                          {g.status === 'active' ? 'Pause' : 'Reactivate'}
                        </Btn>
                      )}
                      <Btn tone="red" onClick={() => removeGig(g)}>
                        Remove
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'transactions' && (
          <>
            <label className="flex items-center gap-2 mb-4 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={attentionOnly}
                onChange={(e) => setAttentionOnly(e.target.checked)}
              />
              Show only payments that need attention (disputes, failed payouts, manual refunds)
            </label>
            <div className={`${PANEL} overflow-x-auto`}>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={TH}>Item</th>
                    <th className={TH}>Buyer</th>
                    <th className={TH}>Seller</th>
                    <th className={TH}>Amount</th>
                    <th className={TH}>Seller gets</th>
                    <th className={TH}>Payment</th>
                    <th className={TH}>Payout</th>
                    <th className={TH}>Dispute</th>
                    <th className={TH}>Date</th>
                    <th className={TH}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTransactions.length === 0 && (
                    <tr>
                      <td className={TD} colSpan={10}>No transactions found</td>
                    </tr>
                  )}
                  {visibleTransactions.map((t) => {
                    const canResolve =
                      t.paymentStatus === 'held' && (t.payoutStatus === 'none' || t.payoutStatus === 'failed');
                    const needsManualRefund = t.paymentStatus === 'captured';

                    return (
                      <tr key={t._id}>
                        <td className={TD}>{itemTitle(t)}</td>
                        <td className={TD}>{t.buyerId?.fullName || 'Unknown'}</td>
                        <td className={TD}>{t.sellerId?.fullName || 'Unknown'}</td>
                        <td className={TD}>{naira(t.amount)}</td>
                        <td className={TD}>{naira(t.sellerPayout)}</td>
                        <td className={TD}>
                          <Pill tone={paymentTone(t.paymentStatus)}>{t.paymentStatus}</Pill>
                        </td>
                        <td className={TD}>
                          <Pill tone={payoutTone(t.payoutStatus)}>{t.payoutStatus}</Pill>
                          {t.payoutError && <div className={SMALL}>{t.payoutError}</div>}
                        </td>
                        <td className={TD}>
                          <Pill tone={disputeTone(t.disputeStatus)}>{t.disputeStatus}</Pill>
                          {t.disputeOpenedAt && (
                            <div className={SMALL}>
                              <strong>Buyer:</strong> {t.disputeReason}
                            </div>
                          )}
                          {t.sellerComplaintAt && (
                            <div className={SMALL}>
                              <strong>Seller:</strong> {t.sellerComplaintReason}
                              {t.sellerComplaintNote ? ` - ${t.sellerComplaintNote}` : ''}
                            </div>
                          )}
                          {t.disputeNotes && <div className={SMALL}>{t.disputeNotes}</div>}
                        </td>
                        <td className={TD}>{formatDate(t.createdAt)}</td>
                        <td className={TD}>
                          {canResolve && (
                            <>
                              <Btn tone="red" onClick={() => openResolve(t, 'refund')}>
                                Refund buyer
                              </Btn>
                              {t.payoutStatus === 'failed' ? (
                                <Btn tone="blue" onClick={() => retryPayout(t)}>
                                  Retry payout
                                </Btn>
                              ) : (
                                <Btn tone="green" onClick={() => openResolve(t, 'release')}>
                                  Pay seller
                                </Btn>
                              )}
                            </>
                          )}
                          {needsManualRefund && (
                            <Btn tone="red" onClick={() => openResolve(t, 'refund')}>
                              Refund buyer
                            </Btn>
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
      </main>

      {resolve && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4"
          onClick={() => !resolving && setResolve(null)}
        >
          <div
            className="bg-[#12121a] border border-white/10 rounded-2xl p-6 w-full max-w-md text-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-white mb-2">
              {resolve.action === 'refund' ? 'Refund the buyer?' : 'Pay the seller?'}
            </h2>
            <p className="text-sm text-gray-300">
              {resolve.action === 'refund'
                ? `${naira(resolve.tx.amount)} goes back to ${resolve.tx.buyerId?.fullName || 'the buyer'}, and "${itemTitle(
                    resolve.tx
                  )}" returns to the seller as expired.`
                : `${naira(resolve.tx.sellerPayout)} is sent to ${resolve.tx.sellerId?.fullName || 'the seller'}.`}
            </p>
            {resolve.tx.disputeOpenedAt && (
              <p className="text-sm text-gray-400 mt-2">Buyer reported: {resolve.tx.disputeReason}</p>
            )}
            {resolve.tx.sellerComplaintAt && (
              <p className="text-sm text-gray-400 mt-2">
                Seller reported: {resolve.tx.sellerComplaintReason}
                {resolve.tx.sellerComplaintNote ? ` - ${resolve.tx.sellerComplaintNote}` : ''}
              </p>
            )}
            {resolve.tx.disputeNotes && (
              <p className="text-sm text-gray-400 mt-2">Notes: {resolve.tx.disputeNotes}</p>
            )}
            <textarea
              className="w-full mt-3 mb-4 p-3 rounded-xl bg-[#0d0d14] border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              rows={3}
              maxLength={500}
              placeholder="Note for both people (optional)"
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setResolve(null)}
                disabled={resolving}
                className="px-5 py-2 rounded-xl border border-white/15 text-gray-200 font-semibold hover:bg-white/5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitResolve}
                disabled={resolving}
                className={`px-5 py-2 rounded-xl font-bold text-white disabled:opacity-60 ${
                  resolve.action === 'refund' ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
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