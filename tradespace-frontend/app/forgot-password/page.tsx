'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import API from '@/lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await API.post('/auth/forgot-password', { email });
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-black">TradeSpace</h1>
          <p className="text-gray-600 mt-2">Reset your password</p>
        </div>

        {done ? (
          <div>
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6 text-sm">
              If an account exists for {email}, we have sent a password reset link. Check your inbox and your spam
              folder. The link works for 1 hour.
            </div>
            <Link href="/login" className="block text-center text-blue-600 font-bold hover:text-blue-700">
              Back to Sign In
            </Link>
          </div>
        ) : (
          <>
            <p className="text-gray-600 text-sm mb-6">
              Enter the email you signed up with and we will send you a link to choose a new password.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-black bg-white"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 mt-2"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <p className="text-center text-gray-600 text-sm mt-6">
              Remembered it?{' '}
              <Link href="/login" className="text-blue-600 font-bold hover:text-blue-700">
                Sign In
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}