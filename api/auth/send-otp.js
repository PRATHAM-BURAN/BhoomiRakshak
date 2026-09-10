// Vercel Serverless API: Send OTP via MSG91
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const phone = body.phone;
    if (!phone) {
      return res.status(400).json({ error: 'Valid phone number is required.' });
    }

    const digits = String(phone).replace(/\D/g, '');
    if (digits.length < 10) {
      return res.status(400).json({ error: 'Invalid phone number format. Please provide a valid 10-digit mobile number.' });
    }

    const normalizedPhone = digits.length === 10 ? `91${digits}` : digits;

    const msg91AuthKey = process.env.MSG91_AUTH_KEY || process.env.MSG91_API_KEY || '568789ADQJR3yfMO316a9f437eP1';
    const templateId = process.env.MSG91_OTP_TEMPLATE_ID || '68c148cbd6fc0538a719c8f3';

    // Generate random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Call MSG91 API directly
    const msg91Url = `https://control.msg91.com/api/v5/otp?mobile=${normalizedPhone}&otp_expiry=5&otp=${otp}${templateId ? `&template_id=${templateId}` : ''}`;
    
    const response = await fetch(msg91Url, {
      method: 'POST',
      headers: {
        'authkey': msg91AuthKey,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    console.log('[MSG91 VERCEL DISPATCH]', { mobile: normalizedPhone, status: response.status, data });

    if (data?.type === 'error') {
      return res.status(502).json({
        error: `SMS Gateway Delivery Failed: ${data.message || 'MSG91 provider rejected request'}`,
        provider_response: data
      });
    }

    return res.status(200).json({
      success: true,
      message: `Verification OTP dispatched to +${normalizedPhone}. Valid for 5 minutes.`,
      phone: normalizedPhone,
      request_id: data.request_id,
      expires_in_seconds: 300
    });
  } catch (err) {
    console.error('[SEND-OTP EXCEPTION]:', err);
    return res.status(500).json({ error: err.message || 'Failed to dispatch verification OTP.' });
  }
}
