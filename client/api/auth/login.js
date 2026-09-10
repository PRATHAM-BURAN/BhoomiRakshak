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

    // 2. Check 8 NER Commanders
    const commanders = [
      { email: 'commander.assam@bhoomirakshak.gov.in', pass: 'AssamCommander2026!', region_id: 'ad2a2d14-f0c0-42eb-ac4a-23a7a42abcf5', name: 'Field Master 1' },
      { email: 'commander.arunachal@bhoomirakshak.gov.in', pass: 'ArunachalCommander2026!', region_id: 'b0000002-0000-0000-0000-000000000002', name: 'Field Master 2' },
      { email: 'commander.sikkim@bhoomirakshak.gov.in', pass: 'SikkimCommander2026!', region_id: 'b0000003-0000-0000-0000-000000000003', name: 'Field Master 3' },
      { email: 'commander.meghalaya@bhoomirakshak.gov.in', pass: 'MeghalayaCommander2026!', region_id: 'b0000004-0000-0000-0000-000000000004', name: 'Field Master 4' },
      { email: 'commander.mizoram@bhoomirakshak.gov.in', pass: 'MizoramCommander2026!', region_id: 'b0000005-0000-0000-0000-000000000005', name: 'Field Master 5' },
      { email: 'commander.nagaland@bhoomirakshak.gov.in', pass: 'NagalandCommander2026!', region_id: 'b0000006-0000-0000-0000-000000000006', name: 'Field Master 6' },
      { email: 'commander.manipur@bhoomirakshak.gov.in', pass: 'ManipurCommander2026!', region_id: 'b0000007-0000-0000-0000-000000000007', name: 'Field Master 7' },
      { email: 'commander.tripura@bhoomirakshak.gov.in', pass: 'TripuraCommander2026!', region_id: 'b0000008-0000-0000-0000-000000000008', name: 'Field Master 8' }
    ];

    const cmd = commanders.find(c => c.email.toLowerCase() === identifier.toLowerCase() && c.pass === password);
    if (cmd) {
      const user = {
        id: `commander-${cmd.region_id}`,
        name: cmd.name,
        email: cmd.email,
        role: 'field_officer',
        region_id: cmd.region_id,
        phone: '9067372943',
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
