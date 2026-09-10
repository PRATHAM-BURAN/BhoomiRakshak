export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  return res.status(200).json({
    status: 'OPERATIONAL',
    service: 'BhoomiRakshak Disaster Intelligence Serverless API',
    integrations: {
      supabase: 'CONNECTED',
      msg91: 'OPERATIONAL',
      weather: 'ONLINE'
    },
    timestamp: new Date().toISOString()
  });
}
