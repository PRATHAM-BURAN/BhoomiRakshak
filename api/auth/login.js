// Vercel Serverless API: Account Password Login
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { identifier, password } = body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Identifier and password are required.' });
    }

    // 1. Check Central Administrator
    if (identifier.toLowerCase() === 'admin@bhoomirakshak.gov.in' && password === 'AdminPassword2026!') {
      const user = {
        id: 'admin-singleton-uuid',
        name: 'Admin',
        email: 'admin@bhoomirakshak.gov.in',
        role: 'admin',
        phone: '9021158105',
        phone_verified: true,
        sms_enabled: true
      };
      const token = Buffer.from(JSON.stringify({ id: user.id, role: user.role, exp: Date.now() + 86400000 })).toString('base64');
      return res.status(200).json({ token, user });
    }

    // 2. Check 8 NER Field Masters
    const commanders = [
      { id: 'c27053d1-d759-43e0-8f3e-a8e577211850', email: 'kailasmutkule99@gmail.com', phone: '9699721767', pass: '9699721767', region_id: 'ad2a2d14-f0c0-42eb-ac4a-23a7a42abcf5', name: 'Kailas Sadashiv Mutkule', district: 'Dima Hasao', state: 'Assam' },
      { id: '830fdcf7-3f56-437f-a05c-e36c5bb4184e', email: 'adishreesukalkar53@gmail.com', phone: '8010986532', pass: '8010986532', region_id: 'b0000002-0000-0000-0000-000000000002', name: 'Adhishree Gajanan Sukalkar', district: 'Papum Pare', state: 'Arunachal Pradesh' },
      { id: '8cb33128-88c2-4b40-9842-4527f8e3e142', email: 'harshhatti291@gmail.com', phone: '9518597050', pass: '9518597050', region_id: 'b0000003-0000-0000-0000-000000000003', name: 'Harsh Umesh Hatti', district: 'North Sikkim', state: 'Sikkim' },
      { id: '76309451-5301-4bbe-934a-4ca5e99bd4d3', email: 'agrawalmanav83@gmail.com', phone: '8625816246', pass: '8625816246', region_id: 'b0000004-0000-0000-0000-000000000004', name: 'Manav Ratan Agrawal', district: 'East Khasi Hills', state: 'Meghalaya' },
      { id: '1d8cce73-2ed5-42a7-8119-89d04c2f1267', email: 'ritikagogawale14@gmail.com', phone: '9623895456', pass: '9623895456', region_id: 'b0000005-0000-0000-0000-000000000005', name: 'Ritika Suresh Gogawale', district: 'Aizawl', state: 'Mizoram' },
      { id: '870f9f21-413b-4830-b309-4393a90604fc', email: 'comp24_pratham.buran@isbmcoe.org', phone: '9067372943', pass: '9067372943', region_id: 'b0000006-0000-0000-0000-000000000006', name: 'pratham prasad buran', district: 'Kohima', state: 'Nagaland' },
      { id: '8725f1fb-33f0-41d3-989d-0fa380d91020', email: 'comp24_amarnath.budhwat@isbmcoe.org', phone: '9922387625', pass: '9922387625', region_id: 'b0000007-0000-0000-0000-000000000007', name: 'Amar', district: 'Senapati', state: 'Manipur' },
      { id: '7dacb6d4-fd59-4581-92a3-a864fc692d74', email: 'comp24_sanskar.mule@isbmcoe.org', phone: '8446222041', pass: '8446222041', region_id: 'b0000008-0000-0000-0000-000000000008', name: 'sanskar mule', district: 'Dhalai', state: 'Tripura' }
    ];

    const cleanId = String(identifier).trim();
    const cleanIdLower = cleanId.toLowerCase();
    const cleanPhoneDigits = cleanId.replace(/\D/g, '').slice(-10);

    const cmd = commanders.find(c => 
      (c.email.toLowerCase() === cleanIdLower || (cleanPhoneDigits.length === 10 && c.phone.slice(-10) === cleanPhoneDigits)) &&
      (c.pass === password || password === c.phone)
    );

    if (cmd) {
      const user = {
        id: cmd.id,
        name: cmd.name,
        email: cmd.email,
        role: 'field_officer',
        region_id: cmd.region_id,
        phone: `+91${cmd.phone}`,
        phone_verified: true,
        sms_enabled: true
      };
      const token = Buffer.from(JSON.stringify({ id: user.id, role: user.role, exp: Date.now() + 86400000 })).toString('base64');
      return res.status(200).json({ token, user });
    }

    // 3. Check Registered Citizens
    const citizens = [
      { id: '8d5d42cb-46e0-498d-9849-48d7641a383a', name: 'pb', email: 'pbstorefile@gmail.com', phone: '9021158105', pass: '9021158105', region_id: 'ad2a2d14-f0c0-42eb-ac4a-23a7a42abcf5' },
      { id: '319abd4b-9544-4a69-bc28-282383649dfb', name: 'Haflong Resident Observer', email: 'citizen.haflong@bhoomirakshak.gov.in', phone: '9876543212', pass: '9876543212', region_id: 'ad2a2d14-f0c0-42eb-ac4a-23a7a42abcf5' },
      { id: 'a3f7814a-29e1-4057-b5f0-f7382e9abb4c', name: 'Pratham Buran', email: 'prathamburan72pb@gmail.com', phone: '9067372943', pass: '9067372943', region_id: 'b0000006-0000-0000-0000-000000000006' },
      { id: '1ed1d716-b4fa-4103-a777-760d234811f5', name: 'Kailas Mutkule', email: 'kailas@gmail.com', phone: '9699721767', pass: '9699721767', region_id: 'ad2a2d14-f0c0-42eb-ac4a-23a7a42abcf5' }
    ];

    const cit = citizens.find(c => 
      (c.email.toLowerCase() === cleanIdLower || (cleanPhoneDigits.length === 10 && c.phone.slice(-10) === cleanPhoneDigits)) &&
      (c.pass === password || password === c.phone)
    );

    if (cit) {
      const user = {
        id: cit.id,
        name: cit.name,
        email: cit.email,
        role: 'citizen',
        region_id: cit.region_id,
        phone: `+91${cit.phone}`,
        phone_verified: true,
        sms_enabled: true
      };
      const token = Buffer.from(JSON.stringify({ id: user.id, role: user.role, exp: Date.now() + 86400000 })).toString('base64');
      return res.status(200).json({ token, user });
    }

    return res.status(401).json({ error: 'Authentication failed. Please verify credentials.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
