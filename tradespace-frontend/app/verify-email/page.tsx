'use client';

import { useEffect, useRef, useState } from 'react';
import { Mail } from 'lucide-react';
import API from '@/lib/api';
import { trackTikTok } from '../components/TikTokPixel';

const RESEND_COOLDOWN_SECONDS = 60;
const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000;

export default function VerifyEmail() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [checking, setChecking] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const isNewAccount = useRef(false);
  const started = useRef(false);

  // Counts the resend wait down
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const markVerifiedLocally = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('user') || 'null');
      if (stored) {
        stored.emailVerified = true;
        localStorage.setItem('user', JSON.stringify(stored));
      }
      return stored;
    } catch (err) {
      return null;
    }
  };

  const sendCode = async (auto: boolean) => {
    setError('');
    setNotice('');
    setSending(true);

    try {
      await API.post('/auth/resend-verification');
      setNotice('We sent a 6-digit code to your email. Check your spam folder too.');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: any) {
      const data = err.response?.data;
      if (auto && data?.code === 'WAIT') {
        setNotice('A code was just sent. Check your email, and your spam folder too.');
        setCooldown(RESEND_COOLDOWN_SECONDS);
      } else {
        setError(data?.error || 'Could not send the code. Please try again.');
      }
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
      return;
    }

    const start = async () => {
      try {
        const me = await API.get('/auth/me');

        if (me.data.emailVerified !== false) {
          markVerifiedLocally();
          window.location.href = '/auctions';
          return;
        }

        setEmail(me.data.email || '');
        isNewAccount.current =
          !!me.data.createdAt && Date.now() - new Date(me.data.createdAt).getTime() < NEW_ACCOUNT_MS;
      } catch (err: any) {
        setChecking(false);
        setError(err.response?.data?.error || 'Could not load your account');
        return;
      }

      setChecking(false);

      // Sign-up already sent a code. From anywhere else, send one now.
      const justSent = new URLSearchParams(window.location.search).get('sent') === '1';
      if (justSent) {
        setNotice('We sent a 6-digit code to your email. Check your spam folder too.');
        setCooldown(RESEND_COOLDOWN_SECONDS);
      } else {
        await sendCode(true);
      }
    };

    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVerify = async (e: any) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your email');
      return;
    }

    setVerifying(true);

    try {
      await API.post('/auth/verify-email', { code });

      const stored = markVerifiedLocally();

      // Only brand new accounts count as a registration and get the welcome tour
      if (isNewAccount.current) {
        trackTikTok('CompleteRegistration');
        if (stored && stored._id) {
          localStorage.setItem('ts_tutorial_pending', String(stored._id));
        }
      }

      setNotice('Email verified. Taking you to the auctions...');
      setTimeout(() => {
        window.location.href = '/auctions';
      }, 600);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not verify your code');
      setVerifying(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
            <Mail className="w-7 h-7 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-black">Verify your email</h1>
          <p className="text-gray-600 mt-2 text-sm">
            {email ? (
              <>
                We sent a 6-digit code to <span className="font-semibold text-black break-all">{email}</span>.
              </>
            ) : (
              'We sent a 6-digit code to your email.'
            )}{' '}
            It works for 15 minutes.
          </p>
        </div>

        {notice && !error && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {notice}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleVerify}>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            className="w-full text-center text-3xl tracking-[0.5em] px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-black bg-white"
          />

          <button
            type="submit"
            disabled={verifying || code.length !== 6}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 mt-4"
          >
            {verifying ? 'Verifying...' : 'Verify email'}
          </button>
        </form>

        <div className="text-center mt-6 text-sm text-gray-600">
          <button
            type="button"
            onClick={() => sendCode(false)}
            disabled={sending || cooldown > 0}
            className="text-blue-600 font-bold hover:text-blue-700 disabled:text-gray-400"
          >
            {sending
              ? 'Sending...'
              : cooldown > 0
              ? `Send a new code in ${cooldown}s`
              : 'Send me a new code'}
          </button>
        </div>

        <div className="text-center mt-4 text-sm text-gray-500">
          Wrong email?{' '}
          <button type="button" onClick={handleLogout} className="text-gray-700 underline hover:text-black">
            Log out and sign up again
          </button>
        </div>
      </div>
    </div>
  );
}