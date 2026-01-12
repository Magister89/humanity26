import { GoogleGenerativeAI } from '@google/generative-ai';
import { kv } from '@vercel/kv';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
const CRON_SECRET = process.env.CRON_SECRET;

const FALLBACK_BSOD = {
  errorCode: '0E_CACHE_MISS',
  address: '0028:C0011E36',
  vxd: 'VPATIENCE.VXD',
  offset: '00010E36',
  message: 'A page fault occurred while loading HUMANITY.SYS. The system is waiting for scheduled maintenance. Please wait for the next cycle or press any key to display a sarcastic message.'
};

function getHourKey() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hour = String(now.getUTCHours()).padStart(2, '0');
  return `bsod:${year}-${month}-${day}-${hour}`;
}

function getExpirationTime() {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1);
  nextHour.setUTCMinutes(0);
  nextHour.setUTCSeconds(0);
  nextHour.setUTCMilliseconds(0);
  return nextHour;
}

async function fetchNewsHeadlines() {
  try {
    const response = await fetch('https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB?hl=en');
    const xml = await response.text();

    const titles = [];
    const regex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g;
    let match = regex.exec(xml);

    while (match !== null && titles.length < 10) {
      const title = match[1] || match[2];
      if (title && title !== 'Google News' && title.trim().length > 0) {
        titles.push(title.trim());
      }
      match = regex.exec(xml);
    }

    return titles.slice(0, 8);
  } catch (error) {
    return [
      'World leaders meet for emergency climate summit',
      'Tech stocks surge amid AI boom',
      'Scientists discover new species in deep ocean',
      'Global economy shows mixed signals'
    ];
  }
}

async function generateBSOD(headlines) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `You are a satirical Windows 98 Blue Screen of Death error message generator. Generate darkly humorous BSOD messages commenting on humanity's failures based on current news.

IMPORTANT: Respond ONLY with valid JSON. No markdown, no code blocks.

Headlines:
${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}

Generate JSON in this exact format:
{
  "errorCode": "0E",
  "address": "0028:C0011E36",
  "vxd": "VMM",
  "offset": "00010E36",
  "message": "2-3 sentence error message"
}

CRITICAL - Use ONLY authentic Windows 98 terminology:
- errorCode: Use real Win98 exception codes (0E, 0D, 06, 0C, 00) but can add satirical suffix like "0E_HUMANITY_FAULT"
- vxd: MUST use .VXD extension (NOT .DLL). Use names like real Win98 drivers: VMM, VFAT, IOS, IFSMGR, CONFIGMG, NDIS, VREDIR, VCOMM, VCACHE, VWIN32, VMOUSE, VKD, VPOWERD - but make them satirical like VHUMANITY, VCOMMON_SENSE, VEMPATHY, VLOGIC, VHOPE
- address: Format like "0028:C00XXXXX" (segment:offset style)
- offset: 8 hex digits

Message guidelines:
- Write like authentic Win98 error: technical but absurd
- Reference "modules", "protected mode", "virtual device", "exception", "page fault"
- Be witty about the news but sound like a real system error
- NO modern OS terms (no "kernel panic", no Linux/Mac references, no "blue screen of death")
- Example tone: "A page fault occurred in module VLOGIC.VXD while processing POLITICAL_DISCOURSE. The system has detected an invalid operation in the COMMON_SENSE subsystem."

Respond with ONLY the JSON object.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();

    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const bsod = JSON.parse(text);

    if (!bsod.errorCode || !bsod.message || !bsod.vxd) {
      throw new Error('Invalid BSOD structure');
    }

    return bsod;
  } catch (error) {
    console.error('AI Generation Error:', error.message, error.stack);
    return {
      errorCode: '0xAI_GENERATION_FAULT',
      address: '0028:DEADBEEF',
      vxd: 'CREATIVITY.DLL',
      offset: '00000000',
      message: `AI_ERROR: ${error.message}`
    };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers['authorization'];
  const isAuthorized = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  const forceRefresh = req.query.force === 'true' && isAuthorized;

  try {
    const hourKey = getHourKey();
    const expiresAt = getExpirationTime();

    let cached = null;
    if (!forceRefresh) {
      try {
        cached = await kv.get(hourKey);
      } catch (kvError) {}

      if (cached) {
        return res.status(200).json({
          bsod: cached,
          generatedAt: cached.generatedAt,
          expiresAt: expiresAt.toISOString(),
          cached: true
        });
      }
    }

    if (!isAuthorized) {
      const fallback = { ...FALLBACK_BSOD, generatedAt: new Date().toISOString() };
      return res.status(200).json({
        bsod: fallback,
        generatedAt: fallback.generatedAt,
        expiresAt: expiresAt.toISOString(),
        cached: false
      });
    }

    const headlines = await fetchNewsHeadlines();
    const bsod = await generateBSOD(headlines);

    bsod.generatedAt = new Date().toISOString();

    try {
      await kv.set(hourKey, bsod, { ex: 3600 });
    } catch (kvError) {}

    return res.status(200).json({
      bsod,
      generatedAt: bsod.generatedAt,
      expiresAt: expiresAt.toISOString(),
      cached: false
    });

  } catch (error) {
    return res.status(500).json({
      error: 'SYSTEM_CRITICAL_FAILURE',
      message: error.message
    });
  }
}
