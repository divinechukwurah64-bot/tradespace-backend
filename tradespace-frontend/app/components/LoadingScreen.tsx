'use client';

import { useEffect, useState } from 'react';

export default function LoadingScreen() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center z-50">
      <style>{`
        @keyframes hammerSwing {
          0% { transform: rotate(-60deg); transform-origin: center top; }
          50% { transform: rotate(0deg); }
          100% { transform: rotate(-60deg); }
        }

        @keyframes boxShake {
          0%, 90% { transform: translateY(0); }
          95% { transform: translateY(-5px); }
          100% { transform: translateY(0); }
        }

        .hammer-head {
          animation: hammerSwing 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
          transform-origin: center top;
          width: 60px;
          height: 60px;
          background: linear-gradient(135deg, #333 0%, #555 100%);
          border-radius: 8px;
        }

        .hammer-handle {
          width: 12px;
          height: 80px;
          background: linear-gradient(90deg, #8B4513 0%, #A0522D 100%);
          margin: 0 auto;
          border-radius: 6px;
        }

        .box {
          animation: boxShake 1.2s ease-in-out infinite;
          width: 100px;
          height: 100px;
          background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 40px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }

        .dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: white;
          margin: 0 4px;
          animation: bounce 1.4s infinite;
        }

        .dot:nth-child(2) {
          animation-delay: 0.2s;
        }

        .dot:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.6; }
          50% { transform: translateY(-10px); opacity: 1; }
        }
      `}</style>

      <div className="text-center">
        <div className="mb-12 h-48 flex flex-col items-center justify-center">
          {/* Hammer */}
          <div className="mb-8">
            <div className="hammer-head mb-2"></div>
            <div className="hammer-handle"></div>
          </div>

          {/* Box being hit */}
          <div className="box">
            ✨
          </div>
        </div>

        <h1 className="text-4xl font-bold text-white mb-4">TradeSpace</h1>
        <div className="text-white text-lg">
          <span>Building marketplace</span>
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>
      </div>
    </div>
  );
}