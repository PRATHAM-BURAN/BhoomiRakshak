export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const report = {
      id: `rep_${Date.now()}`,
      created_at: new Date().toISOString(),
      status: 'pending'
    };
    return res.status(201).json({ report });
  }

  return res.status(200).json({ reports: [] });
}
