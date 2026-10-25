// Works out which website address to send people back to after they pay.
// It prefers the address the request really came from, but only if it is one we trust.
const trustedOrigins = () =>
  [...(process.env.FRONTEND_URL || '').split(','), 'http://localhost:3000']
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

const getFrontendBase = (req) => {
  const origin = String(req.headers.origin || '').replace(/\/+$/, '');

  if (origin) {
    if (trustedOrigins().includes(origin)) return origin;

    if (
      process.env.ALLOW_VERCEL_PREVIEWS === 'true' &&
      /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)
    ) {
      return origin;
    }
  }

  const configured = (process.env.FRONTEND_URL || '').split(',')[0].trim().replace(/\/+$/, '');
  return configured || 'http://localhost:3000';
};

module.exports = { getFrontendBase };