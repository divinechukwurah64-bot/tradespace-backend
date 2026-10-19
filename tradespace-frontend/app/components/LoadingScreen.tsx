'use client';

import { useEffect, useState } from 'react';

export default function LoadingScreen() {
  const [fading, setFading] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 1500);
    const hideTimer = setTimeout(() => setVisible(false), 2000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1868E8',
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.5s ease',
      }}
    >
      <h1
        style={{
          color: '#ffffff',
          fontSize: 64,
          fontWeight: 700,
          letterSpacing: '-2px',
          margin: 0,
        }}
      >
        Tradespace
      </h1>
    </div>
  );
}