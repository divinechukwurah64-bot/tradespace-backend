'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';

const PIXEL_ID = 'DC0ABORC77U7MFIGUBF0';

declare global {
  interface Window {
    ttq?: any;
  }
}

// Use this to report an action, for example trackTikTok('CompleteRegistration')
export const trackTikTok = (event: string, data?: Record<string, unknown>) => {
  try {
    if (typeof window !== 'undefined' && window.ttq) {
      window.ttq.track(event, data);
    }
  } catch (err) {
    // tracking must never break the site
  }
};

export default function TikTokPixel() {
  const pathname = usePathname();
  const firstRender = useRef(true);

  // The base code reports the first page. This reports every page change after that.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    try {
      if (window.ttq) window.ttq.page();
    } catch (err) {
      // ignore
    }
  }, [pathname]);

  const code = `
!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
  ttq.load('${PIXEL_ID}');
  ttq.page();
}(window, document, 'ttq');
`;

  return (
    <Script
      id="tiktok-pixel"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: code }}
    />
  );
}