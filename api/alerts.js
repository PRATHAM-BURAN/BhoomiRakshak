export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const alert = {
      id: `alert_${Date.now()}`,
      region_id: body.region_id || null,
      region_ids: body.region_ids || [],
      severity: body.severity || 'HIGH',
      message: body.message || 'Landslide Warning',
      action_recommendation: body.action_recommendation || 'Evacuate vulnerable slope zones',
      created_at: new Date().toISOString()
    };
    return res.status(201).json({ alert });
  }

  return res.status(200).json({ alerts: [] });
}
