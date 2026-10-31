'use client';

import { useState } from 'react';
import API from '@/lib/api';
import { toast } from '@/lib/dialogs';

const REASONS = [
  'Scam or fraud',
  'Fake or misleading item',
  'Prohibited item',
  'Harassment or abuse',
  'Spam',
  'Other',
];

type Props = {
  targetType: 'auction' | 'comment' | 'user' | 'gig';
  targetId: string;
  label?: string;
  className?: string;
};

export default function ReportButton({ targetType, targetId, label = 'Report', className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const start = () => {
    if (!localStorage.getItem('token')) {
      window.location.href = '/login';
      return;
    }
    setOpen(true);
  };

  const send = async (e: any) => {
    e.preventDefault();
    setSending(true);
    try {
      await API.post('/support/reports', { targetType, targetId, reason, note });
      toast.success('Thanks. Our team will review your report.');
      setOpen(false);
      setNote('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not send your report');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button type="button" onClick={start} className={className || 'text-xs text-gray-500 hover:text-red-600 hover:underline'}>
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
          onClick={() => !sending && setOpen(false)}
        >
          <form
            onSubmit={send}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6"
          >
            <h2 className="text-xl font-bold text-black mb-1">Report this {targetType}</h2>
            <p className="text-sm text-gray-600 mb-4">
              Tell us what is wrong. Your report is private, and the person is not told who sent it.
            </p>

            <label className="block text-sm font-bold text-gray-700 mb-2">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <label className="block text-sm font-bold text-gray-700 mb-2">Details (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Anything that helps us check it"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
            />

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={sending}
                className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className="px-5 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 disabled:bg-gray-400"
              >
                {sending ? 'Sending...' : 'Send report'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}