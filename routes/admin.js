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

type Overview = {
  totalSales: number;
  commissionEarned: number;
  paidOrders: number;
  owedToSellers: number;
  heldCount: number;
  readyToPay: number;
  daily: { date: string; total: number; orders: number }[];
  categories: { category: string; total: number; count: number }[];
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
  sellerId?: {
    _id?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    bankName?: string | null;
    bankAccountName?: string | null;
    bankAccountLast4?: string | null;
  } | null;
  auctionId?: { title?: string } | null;
  gigId?: { title?: string } | null;
};

type TabName = 'overview' | 'users' | 'auctions' | 'gigs' | 'transactions';
type TxFilter = 'all' | 'attention' | 'ready';
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

const DONUT_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#a855f7', '#06b6d4', '#ec4899'];

const PANEL = 'bg-[#12121a] border border-white/10 rounded-2xl';
const TH =
  'text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 border-b border-white/10 whitespace-nowrap';
const TD = 'px-4 py-3 border-b border-white/5 align-top text-sm text-gray-200';
const SMALL = 'text-xs text-gray-400 mt-1 max-w-[260px] break-words';
const INPUT =
  'w-full px-3 py-2 rounded-xl bg-[#0d0d14] border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500';

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

// A payment that is held and still has to reach the seller
const isPayable = (t: AdminTransaction) =>
  t.paymentStatus === 'held' && ['none', 'queued', 'failed'].includes(t.payoutStatus);

const needsAttention = (t: AdminTransaction) =>
  t.disputeStatus === 'filed' || t.payoutStatus === 'failed' || t.paymentStatus === 'captured';

const isReady = (t: AdminTransaction) => isPayable(t) && t.disputeStatus !== 'filed';

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

function Donut({ data }: { data: { category: string; total: number; count: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.total, 0);

  if (total <= 0) {
    return <p className="text-sm text-gray-500 py-8 text-center">No paid sales yet.</p>;
  }

  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox="0 0 120 120" className="w-40 h-40">
        <g transform="rotate(-90 60 60)">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#1f2937" strokeWidth="16" />
          {data.map((d, index) => {
            const length = (d.total / total) * circumference;
            const segment = (
              <circle
                key={d.category}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={DONUT_COLORS[index % DONUT_COLORS.length]}
                strokeWidth="16"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
              />
            );
            offset += length;
            return segment;
          })}
        </g>
      </svg>
      <ul className="w-full space-y-2">
        {data.map((d, index) => (
          <li key={d.category} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: DONUT_COLORS[index % DONUT_COLORS.length] }}
              />
              <span className="text-gray-300 truncate">{d.category}</span>
            </span>
            <span className="text-gray-400 flex-shrink-0">{Math.round((d.total / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<TabName>('overview');
  const [adminName, setAdminName] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [auctions, setAuctions] = useState<AdminAuction[]>([]);
  const [gigs, setGigs] = useState<AdminGig[]>([]);
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [inboxCount, setInboxCount] = useState(0);
  const [txFilter, setTxFilter] = useState<TxFilter>('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const [resolve, setResolve] = useState<{ tx: AdminTransaction; action: 'refund' | 'release' } | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [resolving, setResolving] = useState(false);

  const [manual, setManual] = useState<AdminTransaction | null>(null);
  const [manualRef, setManualRef] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [manualSent, setManualSent] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);

  const getErrorMessage = (err: any) =>
    err?.response?.data?.error || err?.message || 'Something went wrong';

  const loadStats = useCallback(async () => {
    const res = await API.get('/admin/stats');
    setStats(res.data);
  }, []);

  const loadOverview = useCallback(async () => {
    try {
      const res = await API.get('/admin/overview');
      setOverview(res.data);
    } catch (err) {
      // the cards and charts just stay as they were
    }
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
          loadOverview(),
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
  }, [router, loadStats, loadOverview, loadUsers, loadAuctions, loadGigs, loadTransactions, loadInbox]);

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
      await Promise.all([loadTransactions(), loadStats(), loadOverview()]);
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
      await Promise.all([loadTransactions(), loadStats(), loadOverview()]);
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    }
  };

  const openManual = (tx: AdminTransaction) => {
    setManualRef('');
    setManualNote('');
    setManualSent(false);
    setManual(tx);
  };

  const submitManual = async () => {
    if (!manual) return;
    if (manualRef.trim().length < 3) {
      toast.error('Enter the reference or description of your bank transfer');
      return;
    }
    setManualBusy(true);
    try {
      await API.post(`/admin/transactions/${manual._id}/manual-payout`, {
        reference: manualRef.trim(),
        note: manualNote.trim(),
      });
      toast.success('Marked as paid. The seller has been told.');
      setManual(null);
      await Promise.all([loadTransactions(), loadStats(), loadOverview()]);
    } catch (err: any) {
      toast.error(getErrorMessage(err));
      await loadTransactions();
    } finally {
      setManualBusy(false);
    }
  };

  const goToFilter = (filter: TxFilter) => {
    setTxFilter(filter);
    setTab('transactions');
  };

  if (checking) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#08080d] text-gray-300 flex items-center justify-center">
        Loading admin panel...
      </div>
    );
  }

  const visibleTransactions =
    txFilter === 'attention'
      ? transactions.filter(needsAttention)
      : txFilter === 'ready'
      ? transactions.filter(isReady)
      : transactions;

  const attentionCount = transactions.filter(needsAttention).length;
  const manualRefundCount = transactions.filter((t) => t.paymentStatus === 'captured').length;

  const chartData = (overview?.daily || []).map((d) => ({
    value: d.total,
    label: new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
  }));
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

  const filterButton = (active: boolean) =>
    `px-4 py-1.5 rounded-lg text-sm font-semibold border transition ${
      active
        ? 'bg-white text-black border-white'
        : 'bg-[#12121a] text-gray-300 border-white/10 hover:bg-white/5'
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
              <StatCard label="Total sales" value={naira(overview?.totalSales ?? 0)} highlight />
              <StatCard label="Commission earned" value={naira(overview?.commissionEarned ?? 0)} />
              <StatCard label="Paid orders" value={overview?.paidOrders ?? 0} />
              <StatCard label="Owed to sellers" value={naira(overview?.owedToSellers ?? 0)} />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard label="Active auctions" value={stats?.activeAuctions ?? 0} />
              <StatCard label="Total auctions" value={stats?.totalAuctions ?? 0} />
              <StatCard label="Total users" value={stats?.users ?? 0} />
              <StatCard label="Total gigs" value={stats?.totalGigs ?? 0} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
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
                        style={{
                          height: d.value > 0 ? `${Math.max((d.value / chartMax) * 100, 3)}%` : '2px',
                          opacity: d.value > 0 ? 1 : 0.25,
                        }}
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
                    <span className="text-sm text-gray-300">Ready to pay sellers</span>
                    <Pill tone={(overview?.readyToPay ?? 0) > 0 ? 'amber' : 'gray'}>{overview?.readyToPay ?? 0}</Pill>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Inbox (reports and support)</span>
                    <Pill tone={inboxCount > 0 ? 'amber' : 'gray'}>{inboxCount}</Pill>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => goToFilter('attention')}
                    className="inline-flex items-center justify-center gap-2 bg-white text-black rounded-xl py-2 text-sm font-semibold hover:bg-gray-200"
                  >
                    {attentionCount} to review
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => goToFilter('ready')}
                    className="inline-flex items-center justify-center gap-2 border border-white/15 text-gray-200 rounded-xl py-2 text-sm font-semibold hover:bg-white/5"
                  >
                    Payouts to send
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className={`${PANEL} p-5`}>
                <h2 className="font-bold text-white mb-4">Sales by category</h2>
                <Donut data={overview?.categories || []} />
              </div>

              <div className={`${PANEL} overflow-hidden lg:col-span-2`}>
                <div className="flex items-center justify-between px-5 py-4">
                  <h2 className="font-bold text-white">Latest transactions</h2>
                  <button
                    type="button"
                    onClick={() => goToFilter('all')}
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
                      {a.status === 'sold' || a.status === 'awaiting_payment' ? (
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
            <div className="flex flex-wrap gap-2 mb-4">
              <button type="button" onClick={() => setTxFilter('all')} className={filterButton(txFilter === 'all')}>
                All
              </button>
              <button
                type="button"
                onClick={() => setTxFilter('attention')}
                className={filterButton(txFilter === 'attention')}
              >
                Needs attention
              </button>
              <button
                type="button"
                onClick={() => setTxFilter('ready')}
                className={filterButton(txFilter === 'ready')}
              >
                Ready to pay sellers
              </button>
            </div>
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
                    const payable = isPayable(t);
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
                          {payable && (
                            <>
                              <Btn tone="red" onClick={() => openResolve(t, 'refund')}>
                                Refund buyer
                              </Btn>
                              {t.payoutStatus === 'none' && (
                                <Btn tone="green" onClick={() => openResolve(t, 'release')}>
                                  Pay via Paystack
                                </Btn>
                              )}
                              {t.payoutStatus === 'failed' && (
                                <Btn tone="blue" onClick={() => retryPayout(t)}>
                                  Retry payout
                                </Btn>
                              )}
                              <Btn tone="amber" onClick={() => openManual(t)}>
                                Paid manually
                              </Btn>
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
              className={`${INPUT} mt-3 mb-4`}
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

      {manual && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4"
          onClick={() => !manualBusy && setManual(null)}
        >
          <div
            className="bg-[#12121a] border border-white/10 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto text-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-white mb-2">Record a manual payout</h2>
            <p className="text-sm text-gray-300">
              Send <strong>{naira(manual.sellerPayout)}</strong> to {manual.sellerId?.fullName || 'the seller'} from your
              own bank for &quot;{itemTitle(manual)}&quot;, then record it here. The seller is told they have been paid.
              This does not move any money.
            </p>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3 mt-4 text-sm space-y-1">
              <p>
                <span className="text-gray-400">Bank:</span> {manual.sellerId?.bankName || 'Not saved'}
              </p>
              <p>
                <span className="text-gray-400">Name on account:</span> {manual.sellerId?.bankAccountName || 'Not saved'}
              </p>
              <p>
                <span className="text-gray-400">Account ends in:</span>{' '}
                {manual.sellerId?.bankAccountLast4 || 'Not saved'}
              </p>
              <p>
                <span className="text-gray-400">Email:</span> {manual.sellerId?.email || '-'}
              </p>
              <p>
                <span className="text-gray-400">Phone:</span> {manual.sellerId?.phone || '-'}
              </p>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              The full account number is not stored on TradeSpace. Ask the seller for it in a message, and check it
              against the details above.{' '}
              {manual.sellerId?._id && (
                <Link href={`/messages/${manual.sellerId._id}`} className="text-blue-300 hover:underline">
                  Message the seller
                </Link>
              )}
            </p>

            {manual.disputeStatus === 'filed' && (
              <p className="text-sm text-amber-300 mt-3">
                This sale has an open problem. Recording the payout closes it in the seller&apos;s favour.
              </p>
            )}

            <label className="block text-sm text-gray-300 mt-4 mb-1">Bank transfer reference</label>
            <input
              className={INPUT}
              type="text"
              maxLength={100}
              placeholder="For example the transfer reference or time sent"
              value={manualRef}
              onChange={(e) => setManualRef(e.target.value)}
            />

            <textarea
              className={`${INPUT} mt-3`}
              rows={2}
              maxLength={500}
              placeholder="Note for the seller (optional)"
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
            />

            <label className="flex items-start gap-2 text-sm text-gray-300 mt-4">
              <input
                type="checkbox"
                className="mt-1"
                checked={manualSent}
                onChange={(e) => setManualSent(e.target.checked)}
              />
              I have sent {naira(manual.sellerPayout)} to the seller
            </label>

            <div className="flex justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={() => setManual(null)}
                disabled={manualBusy}
                className="px-5 py-2 rounded-xl border border-white/15 text-gray-200 font-semibold hover:bg-white/5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitManual}
                disabled={manualBusy || !manualSent || manualRef.trim().length < 3}
                className="px-5 py-2 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {manualBusy ? 'Saving...' : 'Mark as paid'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}