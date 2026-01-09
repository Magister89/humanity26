import crypto from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.MESSAGE_KEY;
  const combo = process.env.MESSAGE_COMBO;

  if (!key || !combo) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  const { keys } = req.body || {};

  if (!keys || !Array.isArray(keys)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const submitted = keys.map(k => k.toLowerCase()).sort().join('');

  if (submitted !== combo) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const encryptedPath = join(process.cwd(), 'data', 'message.enc.json');
    const encryptedData = JSON.parse(readFileSync(encryptedPath, 'utf8'));

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(key, 'hex'),
      Buffer.from(encryptedData.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

    let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    const message = JSON.parse(decrypted);

    return res.status(200).json({ message });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to decrypt message' });
  }
}
