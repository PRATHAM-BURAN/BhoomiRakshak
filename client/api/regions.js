export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const DEFAULT_NER_REGIONS = [
    { id: "ad2a2d14-f0c0-42eb-ac4a-23a7a42abcf5", district: "Dima Hasao", state: "Assam", name: "Lumding-Haflong-Badarpur NH-27 Corridor" },
    { id: "b0000002-0000-0000-0000-000000000002", district: "Papum Pare", state: "Arunachal Pradesh", name: "Papum Pare Foothills NH-415 Corridor" },
    { id: "b0000003-0000-0000-0000-000000000003", district: "North Sikkim", state: "Sikkim", name: "Mangan-Gangtok Teesta Valley NH-10 Corridor" },
    { id: "b0000004-0000-0000-0000-000000000004", district: "East Khasi Hills", state: "Meghalaya", name: "Shillong-Cherrapunji Escarpment NH-6 Corridor" },
    { id: "b0000005-0000-0000-0000-000000000005", district: "Aizawl", state: "Mizoram", name: "Aizawl North - Durtlang Ridge NH-54 Corridor" },
    { id: "b0000006-0000-0000-0000-000000000006", district: "Kohima", state: "Nagaland", name: "Dimapur-Kohima Range NH-29 Corridor" },
    { id: "b0000007-0000-0000-0000-000000000007", district: "Senapati", state: "Manipur", name: "Senapati-Imphal Valley NH-2 Corridor" },
    { id: "b0000008-0000-0000-0000-000000000008", district: "Dhalai", state: "Tripura", name: "Ambassa-Manu Hill Ranges NH-8 Corridor" }
  ];

  return res.status(200).json({ regions: DEFAULT_NER_REGIONS });
}
