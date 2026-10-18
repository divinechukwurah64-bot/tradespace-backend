'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import API, { authAPI } from '../../lib/api';

type Stats = {
  users: number;
  bannedUsers: number;
  activeAuctions: number;
  totalAuctions: number;
};

type AdminUser = {
  _id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: string;
  isBanned: boolean;
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

const s = {
  page: { maxWidth: 1100, margin: '0 auto', padding: '32px 16px', color: '#111827' } as React.CSSProperties,
  title: { fontSize: 28, fontWeight: 700, marginBottom: 24 } as React.CSSProperties,
  statsRow: { display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 28 } as React.CSSProperties,
  statCard: { flex: '1 1 200px', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 } as React.CSSProperties,
  statNumber: { fontSize: 30, fontWeight: 700 } as React.CSSProperties,
  statLabel: { fontSize: 14, color: '#6b7280', marginTop: 4 } as React.CSSProperties,
  tabs: { display: 'flex', gap: 8, marginBottom: 16 } as React.CSSProperties,
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
  td: { padding: '12px 14px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' } as React.CSSProperties,
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
  search: { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, width: 280, marginBottom: 12 } as React.CSSProperties,
  error: { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: 12, borderRadius: 8, marginBottom: 16 } as React.CSSProperties,
};

const naira = (n: number | null | undefined) =>
  n === null || n === undefined ? '-' : `\u20A6${Number(n).toLocaleString()}`;

const formatDate = (d: string) => new Date(d).toLocaleString();

export default function AdminPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<'users' | 'auctions'>('users');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [auctions, setAuctions] = useState<AdminAuction[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

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
        await Promise.all([loadStats(), loadUsers(''), loadAuctions()]);
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
  }, [router, loadStats, loadUsers, loadAuctions]);

  const handleSearch = async (value: string) => {
    setSearch(value);
    try {
      await loadUsers(value);
    } catch (err: any) {
      setError(getErrorMessage(err));
    }
  };

  const toggleBan = async (user: AdminUser) => {
    const action = user.isBanned ? 'unban' : 'ban';
    if (!window.confirm(`Are you sure you want to ${action} ${user.fullName}?`)) return;
    try {
      setError('');
      await API.patch(`/admin/users/${user._id}/ban`);
      await Promise.all([loadUsers(search), loadStats()]);
    } catch (err: any) {
      setError(getErrorMessage(err));
    }
  };

  const endAuction = async (auction: AdminAuction) => {
    if (!window.confirm(`End the auction "${auction.title}" now?`)) return;
    try {
      setError('');
      await API.patch(`/admin/auctions/${auction._id}/end`);
      await Promise.all([loadAuctions(), loadStats()]);
    } catch (err: any) {
      setError(getErrorMessage(err));
    }
  };

  const removeAuction = async (auction: AdminAuction) => {
    if (!window.confirm(`Permanently remove "${auction.title}"? This cannot be undone.`)) return;
    try {
      setError('');
      await API.delete(`/admin/auctions/${auction._id}`);
      await Promise.all([loadAuctions(), loadStats()]);
    } catch (err: any) {
      setError(getErrorMessage(err));
    }
  };

  if (checking) {
    return (
      <div style={s.page}>
        <p>Loading admin panel...</p>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <h1 style={s.title}>Admin Panel</h1>

      {error && <div style={s.error}>{error}</div>}

      {stats && (
        <div style={s.statsRow}>
          <div style={s.statCard}>
            <div style={s.statNumber}>{stats.users}</div>
            <div style={s.statLabel}>Total users</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statNumber}>{stats.bannedUsers}</div>
            <div style={s.statLabel}>Banned users</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statNumber}>{stats.activeAuctions}</div>
            <div style={s.statLabel}>Active auctions</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statNumber}>{stats.totalAuctions}</div>
            <div style={s.statLabel}>Total auctions</div>
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
                  <th style={s.th}>Joined</th>
                  <th style={s.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td style={s.td} colSpan={7}>No users found</td>
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
                    </td>
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
                        a.status === 'active' ? '#16a34a' : a.status === 'sold' ? '#2563eb' : '#6b7280'
                      )}
                    >
                      {a.status}
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
    </div>
  );
}