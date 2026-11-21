'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';

type Step = {
  title: string;
  body: string;
  selector?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
};

const STEPS: Step[] = [
  {
    title: 'Welcome to TradeSpace',
    body: 'TradeSpace is a Nigerian marketplace where you bid on items in live auctions and offer or hire services. This quick tour shows you how it works.',
    position: 'center',
  },
  {
    title: 'Browse auctions',
    body: 'Open Auctions to see everything up for sale. You can search, sort by price or time, and filter by category.',
    selector: '[data-tutorial="auctions-link"]',
    position: 'bottom',
  },
  {
    title: 'Live streams',
    body: 'When this button is red, sellers are live right now showing their items while people bid. Tap it to watch.',
    selector: '[data-tutorial="live-link"]',
    position: 'bottom',
  },
  {
    title: 'Placing a bid',
    body: 'On any auction page, enter your amount and press Place Bid. Each bid must be at least ₦100 more than the current one. The seller picks which bid to accept.',
    position: 'center',
  },
  {
    title: 'Your money is protected',
    body: 'When you win and pay, TradeSpace holds your money. The seller only gets paid after you confirm the item arrived, or automatically after 7 days.',
    position: 'center',
  },
  {
    title: 'Confirming delivery',
    body: 'Once the item arrives, go back to the auction page and press "I received the item". If something is wrong, press "Report a problem" and the payment is frozen.',
    position: 'center',
  },
  {
    title: 'Selling an item',
    body: 'Press Create Auction on the Auctions page. Add up to 5 photos, write a description, set a starting price of at least ₦500, and your auction runs for 24 hours.',
    selector: '[data-tutorial="create-auction-btn"]',
    position: 'bottom',
  },
  {
    title: 'Messages and notifications',
    body: 'The speech bubble icon shows your messages. You can message sellers before bidding and buyers after a sale. The bell shows your notifications.',
    selector: '[data-tutorial="messages-link"]',
    position: 'bottom',
  },
  {
    title: "You're ready",
    body: 'That is everything. Browse the auctions to get started, or list something you want to sell. You can open this tour again any time from the help button or the menu.',
    position: 'center',
  },
];

// Returns null when the element is missing or hidden (for example desktop links on a phone),
// so that step falls back to a centred card.
function getRect(selector: string): DOMRect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return rect;
}

function Backdrop() {
  return (
    <div
      className="fixed inset-0"
      style={{ zIndex: 59, background: 'rgba(0,0,0,0.6)' }}
    />
  );
}

function Spotlight({ rect }: { rect: DOMRect }) {
  const pad = 8;
  const top = rect.top - pad;
  const left = rect.left - pad;
  const width = rect.width + pad * 2;
  const height = rect.height + pad * 2;

  return (
    <svg
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 59 }}
    >
      <defs>
        <mask id="spotlight-mask">
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <rect x={left} y={top} width={width} height={height} rx="8" fill="black" />
        </mask>
      </defs>
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.65)"
        mask="url(#spotlight-mask)"
      />
      <rect
        x={left}
        y={top}
        width={width}
        height={height}
        rx="8"
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2"
      />
    </svg>
  );
}

function Bubble({
  step,
  rect,
  stepIndex,
  total,
  onNext,
  onPrev,
  onSkip,
}: {
  step: Step;
  rect: DOMRect | null;
  stepIndex: number;
  total: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === total - 1;
  const position = step.position || (rect ? 'bottom' : 'center');

  const pad = 16;
  const bubbleW = Math.min(320, window.innerWidth - pad * 2);
  const bubbleH = 220;

  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 61,
    width: bubbleW,
  };

  if (position === 'center' || !rect) {
    style.top = '50%';
    style.left = '50%';
    style.transform = 'translate(-50%, -50%)';
  } else {
    const clampLeft = (value: number) =>
      Math.max(pad, Math.min(value, window.innerWidth - bubbleW - pad));

    if (position === 'bottom') {
      style.top = Math.min(rect.bottom + pad, window.innerHeight - bubbleH - pad);
      style.left = clampLeft(rect.left);
    } else if (position === 'top') {
      style.top = Math.max(pad, rect.top - bubbleH - pad);
      style.left = clampLeft(rect.left);
    } else if (position === 'right') {
      style.top = Math.max(pad, rect.top);
      style.left = clampLeft(rect.right + pad);
    } else {
      style.top = Math.max(pad, rect.top);
      style.left = clampLeft(rect.left - bubbleW - pad);
    }
  }

  return (
    <div
      style={style}
      className="bg-white rounded-2xl shadow-2xl p-5 border border-gray-100"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-bold text-black text-base leading-snug">{step.title}</h3>
        <button
          type="button"
          onClick={onSkip}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 mt-0.5"
          aria-label="Close tutorial"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-sm text-gray-600 leading-relaxed mb-4">{step.body}</p>

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`block rounded-full transition-all ${
                i === stepIndex ? 'w-4 h-1.5 bg-blue-600' : 'w-1.5 h-1.5 bg-gray-300'
              }`}
            />
          ))}
        </div>

        <div className="flex gap-2">
          {!isFirst && (
            <button
              type="button"
              onClick={onPrev}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
          )}
          {isFirst && (
            <button
              type="button"
              onClick={onSkip}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-sm hover:bg-gray-50"
            >
              Skip
            </button>
          )}
          <button
            type="button"
            onClick={isLast ? onSkip : onNext}
            className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-500"
          >
            {isLast ? (
              'Done'
            ) : (
              <>
                Next
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Kept so any file that still imports it keeps building. The Navbar now decides when to open the tour.
export function useTutorial() {
  const [open, setOpen] = useState(false);
  const start = useCallback(() => setOpen(true), []);
  return { open, start, setOpen };
}

export default function Tutorial({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const current = STEPS[step];

  useEffect(() => {
    if (!open) return;
    setStep(0);
  }, [open]);

  // Finds the highlighted element for this step, and follows it if the screen changes
  useEffect(() => {
    if (!open) return;

    const measure = () => {
      setRect(current.selector ? getRect(current.selector) : null);
    };

    if (current.selector) {
      const el = document.querySelector(current.selector) as HTMLElement | null;
      el?.scrollIntoView({ block: 'nearest' });
    }

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);

    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, step, current.selector]);

  if (!open) return null;

  return (
    <>
      {rect ? <Spotlight rect={rect} /> : <Backdrop />}
      <Bubble
        step={current}
        rect={rect}
        stepIndex={step}
        total={STEPS.length}
        onNext={() => setStep((s) => Math.min(s + 1, STEPS.length - 1))}
        onPrev={() => setStep((s) => Math.max(s - 1, 0))}
        onSkip={onClose}
      />
    </>
  );
}