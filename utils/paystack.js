const axios = require('axios');

const http = () => {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    const err = new Error('PAYSTACK_SECRET_KEY is not set');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }
  return axios.create({
    baseURL: 'https://api.paystack.co',
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    timeout: 15000
  });
};

const isTestMode = () => (process.env.PAYSTACK_SECRET_KEY || '').startsWith('sk_test_');

// True when Paystack says the details were rejected, as opposed to Paystack being down
const isLookupFailure = (err) =>
  !!(err.response && [400, 404, 422].includes(err.response.status));

let bankCache = { at: 0, banks: [] };

// Nigerian banks, cached for 24 hours
const listBanks = async () => {
  if (bankCache.banks.length && Date.now() - bankCache.at < 24 * 60 * 60 * 1000) {
    return bankCache.banks;
  }

  const client = http();
  let all = [];
  let next = null;

  for (let i = 0; i < 10; i++) {
    const params = { country: 'nigeria', currency: 'NGN', use_cursor: true, perPage: 100 };
    if (next) params.next = next;

    const res = await client.get('/bank', { params });
    all = all.concat(res.data.data || []);
    next = res.data.meta && res.data.meta.next;
    if (!next) break;
  }

  const seen = new Set();
  const banks = all
    .filter((b) => b && b.code && b.name && b.active !== false && !b.is_deleted && (!b.type || b.type === 'nuban'))
    .filter((b) => {
      if (seen.has(b.code)) return false;
      seen.add(b.code);
      return true;
    })
    .map((b) => ({ name: b.name, code: b.code }))
    .sort((a, b) => a.name.localeCompare(b.name));

  bankCache = { at: Date.now(), banks };
  return banks;
};

// Asks Paystack whose account this is
const resolveAccount = async (accountNumber, bankCode) => {
  const res = await http().get('/bank/resolve', {
    params: { account_number: accountNumber, bank_code: bankCode }
  });
  return res.data.data.account_name;
};

// A recipient is what we pay out to later
const createRecipient = async ({ name, accountNumber, bankCode }) => {
  const res = await http().post('/transferrecipient', {
    type: 'nuban',
    name,
    account_number: accountNumber,
    bank_code: bankCode,
    currency: 'NGN'
  });
  return res.data.data.recipient_code;
};

// Starts a checkout. Returns { authorization_url, access_code, reference }
const initializeTransaction = async ({ email, amountKobo, reference, callbackUrl, metadata }) => {
  const res = await http().post('/transaction/initialize', {
    email,
    amount: amountKobo,
    currency: 'NGN',
    reference,
    callback_url: callbackUrl,
    metadata
  });
  return res.data.data;
};

// Asks Paystack what really happened to a payment
const verifyTransaction = async (reference) => {
  const res = await http().get(`/transaction/verify/${encodeURIComponent(reference)}`);
  return res.data.data;
};

// Sends the money back to the buyer
const refundTransaction = async (reference) => {
  const res = await http().post('/refund', { transaction: reference });
  return res.data.data;
};

module.exports = {
  isTestMode,
  isLookupFailure,
  listBanks,
  resolveAccount,
  createRecipient,
  initializeTransaction,
  verifyTransaction,
  refundTransaction
};