export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const rawToken = authHeader.slice(7);
    const decoded = JSON.parse(Buffer.from(rawToken, 'base64').toString('utf8'));
    return res.status(200).json({
      user: {
        id: decoded.id,
        role: decoded.role || 'citizen',
        name: decoded.role === 'admin' ? 'Admin' : (decoded.role === 'field_officer' ? 'Field Master' : 'Citizen Member'),
        email: decoded.role === 'admin' ? 'admin@bhoomirakshak.gov.in' : 'citizen@bhoomirakshak.in'
      }
    });
  } catch (err) {
    return res.status(401).json({ error: 'Session expired' });
  }
}
