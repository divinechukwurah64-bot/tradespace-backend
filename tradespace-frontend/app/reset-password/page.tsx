'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import API from '@/lib/api';

export default function ResetPassword() {
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token') || '');
    setReady(true);
  }, []);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await API.post('/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => {
        window.location.href = '/login';
      }, 2500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-black">TradeSpace</h1>
          <p className="text-gray-600 mt-2">Choose a new password</p>
        </div>

        {!token ? (
          <div className="text-center">
            <p className="text-gray-700 mb-4">This reset link is not valid.</p>
            <Link href="/forgot-password" className="text-blue-600 font-bold hover:text-blue-700">
              Request a new link
            </Link>
          </div>
        ) : done ? (
          <div>
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6 text-sm">
              Your password has been reset. Taking you to sign in...
            </div>
            <Link href="/login" className="block text-center text-blue-600 font-bold hover:text-blue-700">
              Sign In now
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
                {error}{' '}
                {error.includes('invalid or has expired') && (
                  <Link href="/forgot-password" className="font-bold underline">
                    Request a new link
                  </Link>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-black bg-white"
                    placeholder="At least 8 characters"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm new password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-black bg-white"
                    placeholder="Repeat the password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 mt-2"
              >
                {loading ? 'Saving...' : 'Reset Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}