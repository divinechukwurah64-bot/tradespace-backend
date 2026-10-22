const axios = require('axios');

const detail = (err) =>
  err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;

// Sends mail over HTTPS, because Railway blocks SMTP on the Hobby plan.
// Uses Resend if RESEND_API_KEY is set, otherwise Brevo if BREVO_API_KEY is set.
const sendEmail = async ({ to, subject, html, text }) => {
  const fromEmail = process.env.MAIL_FROM;
  const fromName = process.env.MAIL_FROM_NAME || 'TradeSpace';

  if (!fromEmail) {
    throw new Error('MAIL_FROM is not set');
  }

  try {
    if (process.env.RESEND_API_KEY) {
      await axios.post(
        'https://api.resend.com/emails',
        { from: `${fromName} <${fromEmail}>`, to: [to], subject, html, text },
        {
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
          timeout: 15000
        }
      );
      return;
    }

    if (process.env.BREVO_API_KEY) {
      await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        {
          sender: { name: fromName, email: fromEmail },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text
        },
        {
          headers: {
            'api-key': process.env.BREVO_API_KEY,
            'content-type': 'application/json',
            accept: 'application/json'
          },
          timeout: 15000
        }
      );
      return;
    }
  } catch (err) {
    throw new Error(`Email provider error: ${detail(err)}`);
  }

  throw new Error('No email provider configured. Set RESEND_API_KEY or BREVO_API_KEY.');
};

module.exports = sendEmail;