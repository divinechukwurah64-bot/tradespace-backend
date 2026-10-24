'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { registerDialogHost } from '@/lib/dialogs';
import type { ConfirmOptions, ToastType } from '@/lib/dialogs';

type ToastItem = { id: number; type: ToastType; message: string };
type PendingConfirm = { options: ConfirmOptions; resolve: (value: boolean) => void };

const TOAST_STYLES: Record<ToastType, string> = {
  success: 'border-green-500',
  error: 'border-red-500',
  info: 'border-blue-500',
};

export default function DialogHost() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const pendingRef = useRef<PendingConfirm | null>(null);
  const nextId = useRef(1);
  const confirmButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    return registerDialogHost({
      onConfirm: (options, resolve) => {
        // If another box is still open, close it as cancelled
        if (pendingRef.current) pendingRef.current.resolve(false);
        const item = { options, resolve };
        pendingRef.current = item;
        setPending(item);
      },
      onToast: (type, message) => {
        const id = nextId.current++;
        setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
        setTimeout(
          () => setToasts((prev) => prev.filter((t) => t.id !== id)),
          type === 'error' ? 6000 : 4000
        );
      },
    });
  }, []);

  const close = (result: boolean) => {
    if (!pendingRef.current) return;
    pendingRef.current.resolve(result);
    pendingRef.current = null;
    setPending(null);
  };

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    confirmButton.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const options = pending?.options;

  return (
    <>
      {pending && options && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
          onClick={() => close(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="dialog-title" className="text-xl font-bold text-black mb-2">
              {options.title || 'Are you sure?'}
            </h2>
            <p className="text-gray-700 mb-6 whitespace-pre-line">{options.message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => close(false)}
                className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50"
              >
                {options.cancelText || 'Cancel'}
              </button>
              <button
                ref={confirmButton}
                onClick={() => close(true)}
                className={`px-5 py-2 rounded-lg text-white font-bold ${
                  options.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {options.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed top-4 right-4 z-[110] flex flex-col gap-3 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start justify-between gap-3 rounded-lg shadow-lg border-l-4 bg-white px-4 py-3 ${TOAST_STYLES[t.type]}`}
          >
            <p className="text-sm text-gray-800">{t.message}</p>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="flex-shrink-0">
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}