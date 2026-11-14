const crypto = require('crypto');

// Encrypts short secrets, such as bank account numbers, before they go in the database.
// The key is BANK_ENCRYPTION_KEY: 64 hex characters (32 bytes), kept only on the server.

const getKey = () => {
  const hex = process.env.BANK_ENCRYPTION_KEY || '';
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) return null;
  return Buffer.from(hex, 'hex');
};

const isConfigured = () => !!getKey();

const encryptText = (plain) => {
  const key = getKey();
  if (!key) {
    throw new Error('BANK_ENCRYPTION_KEY is not set');
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
};

const decryptText = (stored) => {
  const key = getKey();
  if (!key) {
    throw new Error('BANK_ENCRYPTION_KEY is not set');
  }

  const [ivHex, tagHex, dataHex] = String(stored || '').split(':');
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error('The stored value is not valid');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
};

module.exports = { isConfigured, encryptText, decryptText };