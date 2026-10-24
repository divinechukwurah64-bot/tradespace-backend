'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import API from '@/lib/api';

// True when the account name shares at least one name with the profile name
const namesMatch = (a: string, b: string) => {
  const tokens = (s: string) => s.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  const other = tokens(b);
  return tokens(a).some((t) => other.includes(t));
};

export default function PayoutDetails() {
  const [loading, setLoading] = useState(true);
  const [banks, setBanks] = useState<any[]>([]);
  const [saved, setSaved] = useState<any>(null);
  const [myName, setMyName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [resolvedName, setResolvedName] = useState('');
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
      return;
    }

    const load = async () => {
      try {
        const [bankRes, listRes, meRes] = await Promise.all([
          API.get('/users/me/bank'),
          API.get('/users/banks'),
          API.get('/auth/me'),
        ]);
        setSaved(bankRes.data.hasBank ? bankRes.data : null);
        setBanks(listRes.data);
        setMyName(meRes.data.fullName || '');
      } catch (err: any) {
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return;
        }
        setError(err.response?.data?.error || 'Could not load your payout details');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleVerify = async () => {
    setError('');
    setMessage('');

    if (!bankCode) {
      setError('Choose your bank');
      return;
    }
    if (!/^\d{10}$/.test(accountNumber)) {
      setError('Enter your 10 digit account number');
      return;
    }

    setVerifying(true);
    try {
      const response = await API.post('/users/me/bank/resolve', { bankCode, accountNumber });
      setResolvedName(response.data.accountName);
    } catch (err: any) {
      setResolvedName('');
      setError(err.response?.data?.error || 'Could not verify this account');
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = async (e: any) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);

    try {
      const response = await API.put('/users/me/bank', { bankCode, accountNumber, password });
      setSaved(response.data);
      setBankCode('');
      setAccountNumber('');
      setResolvedName('');
      setPassword('');
      setMessage('Your payout account has been saved');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not save your payout account');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <Link href="/profile" className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4">
            <ArrowLeft className="w-5 h-5" />
            Back to profile
          </Link>
          <h1 className="text-3xl font-bold text-black">Payout account</h1>
          <p className="text-gray-600 mt-2">
            This is where your sales money is sent after the buyer confirms they received the item.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}
        {message && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6 text-sm">
            {message}
          </div>
        )}

        {saved && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <p className="text-sm text-gray-600 mb-1">Saved account</p>
            <p className="text-lg font-bold text-black">{saved.accountName}</p>
            <p className="text-gray-700">
              {saved.bankName} - ending {saved.accountLast4}
            </p>
            <p className="text-xs text-gray-500 mt-3">
              To change it, enter the new details below. We only keep the last 4 digits of your account number.
            </p>
          </div>
        )}

        <form onSubmit={handleSave} className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-black mb-4">{saved ? 'Change payout account' : 'Add payout account'}</h2>

          <label className="block text-sm font-medium text-gray-700 mb-2">Bank</label>
          <select
            value={bankCode}
            onChange={(e) => {
              setBankCode(e.target.value);
              setResolvedName('');
            }}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:border-blue-500 text-black bg-white"
          >
            <option value="">Select your bank</option>
            {banks.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>

          <label className="block text-sm font-medium text-gray-700 mb-2">Account number</label>
          <input
            type="text"
            inputMode="numeric"
            value={accountNumber}
            onChange={(e) => {
              setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10));
              setResolvedName('');
            }}
            required
            placeholder="10 digit account number"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:border-blue-500 text-black bg-white"
          />

          {!resolvedName ? (
            <button
              type="button"
              onClick={handleVerify}
              disabled={verifying}
              className="w-full bg-gray-800 text-white py-2 rounded-lg font-bold hover:bg-black disabled:bg-gray-400"
            >
              {verifying ? 'Checking...' : 'Verify account'}
            </button>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600">Account name</p>
                <p className="text-lg font-bold text-black">{resolvedName}</p>
                {myName && !namesMatch(resolvedName, myName) && (
                  <p className="text-sm text-red-600 mt-2">
                    This name does not match your TradeSpace name ({myName}). Only continue if this is your own
                    account.
                  </p>
                )}
              </div>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your TradeSpace password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Needed to confirm it is you"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:border-blue-500 text-black bg-white"
              />

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400"
              >
                {saving ? 'Saving...' : 'This is my account - save it'}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}