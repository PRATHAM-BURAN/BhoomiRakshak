// BhoomiRakshak Database Seed Script: 8 NER Regions + 1 Admin + 8 Field Commanders
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { localDB, isSupabaseConfigured, supabase } from './db.js';

// 1. The 8 Northeast India (NER) Monitored Regions (Standardized UUIDs)
export const NER_REGIONS = [
  {
    id: "ad2a2d14-f0c0-42eb-ac4a-23a7a42abcf5",
    name: "Lumding-Haflong-Badarpur NH-27 Corridor",
    state: "Assam",
    district: "Dima Hasao",
    geometry: {
      type: "Polygon",
      coordinates: [[[92.8, 25.1], [93.2, 25.1], [93.2, 25.4], [92.8, 25.4], [92.8, 25.1]]]
    }
  },
  {
    id: "b0000002-0000-0000-0000-000000000002",
    name: "Papum Pare Foothills NH-415 Corridor",
    state: "Arunachal Pradesh",
    district: "Papum Pare",
    geometry: {
      type: "Polygon",
      coordinates: [[[93.4, 27.0], [93.8, 27.0], [93.8, 27.3], [93.4, 27.3], [93.4, 27.0]]]
    }
  },
  {
    id: "b0000003-0000-0000-0000-000000000003",
    name: "Mangan-Gangtok Teesta Valley NH-10 Corridor",
    state: "Sikkim",
    district: "North Sikkim",
    geometry: {
      type: "Polygon",
      coordinates: [[[88.4, 27.4], [88.7, 27.4], [88.7, 27.7], [88.4, 27.7], [88.4, 27.4]]]
    }
  },
  {
    id: "b0000004-0000-0000-0000-000000000004",
    name: "Shillong-Cherrapunji Escarpment NH-6 Corridor",
    state: "Meghalaya",
    district: "East Khasi Hills",
    geometry: {
      type: "Polygon",
      coordinates: [[[91.7, 25.4], [92.0, 25.4], [92.0, 25.7], [91.7, 25.7], [91.7, 25.4]]]
    }
  },
  {
    id: "b0000005-0000-0000-0000-000000000005",
    name: "Aizawl North - Durtlang Ridge NH-54 Corridor",
    state: "Mizoram",
    district: "Aizawl",
    geometry: {
      type: "Polygon",
      coordinates: [[[92.6, 23.6], [92.9, 23.6], [92.9, 23.9], [92.6, 23.9], [92.6, 23.6]]]
    }
  },
  {
    id: "b0000006-0000-0000-0000-000000000006",
    name: "Dimapur-Kohima Range NH-29 Corridor",
    state: "Nagaland",
    district: "Kohima",
    geometry: {
      type: "Polygon",
      coordinates: [[[94.0, 25.5], [94.3, 25.5], [94.3, 25.8], [94.0, 25.8], [94.0, 25.5]]]
    }
  },
  {
    id: "b0000007-0000-0000-0000-000000000007",
    name: "Senapati-Imphal Valley NH-2 Corridor",
    state: "Manipur",
    district: "Senapati",
    geometry: {
      type: "Polygon",
      coordinates: [[[93.8, 25.1], [94.1, 25.1], [94.1, 25.4], [93.8, 25.4], [93.8, 25.1]]]
    }
  },
  {
    id: "b0000008-0000-0000-0000-000000000008",
    name: "Ambassa-Manu Hill Ranges NH-8 Corridor",
    state: "Tripura",
    district: "Dhalai",
    geometry: {
      type: "Polygon",
      coordinates: [[[91.8, 23.8], [92.1, 23.8], [92.1, 24.1], [91.8, 24.1], [91.8, 23.8]]]
    }
  }
];

// 2. The 1 Administrator + 8 Field Masters / Sector Commanders Definitions
export const SEED_CREDENTIALS = {
  admin: {
    id: "usr-admin-master-01",
    role: "admin",
    name: "Admin",
    email: "admin@bhoomirakshak.gov.in",
    phone: "+919876543210",
    password: "AdminPassword2026!",
    region_id: null,
    language_pref: "en"
  },
  commanders: [
    {
      id: "usr-cmdr-01-assam",
      role: "field_officer",
      name: "Field Master 1",
      email: "commander.assam@bhoomirakshak.gov.in",
      phone: "+919876500001",
      password: "AssamCommander2026!",
      region_id: "ad2a2d14-f0c0-42eb-ac4a-23a7a42abcf5",
      state: "Assam",
      district: "Dima Hasao",
      language_pref: "as"
    },
    {
      id: "usr-cmdr-02-arunachal",
      role: "field_officer",
      name: "Field Master 2",
      email: "commander.arunachal@bhoomirakshak.gov.in",
      phone: "+919876500002",
      password: "ArunachalCommander2026!",
      region_id: "b0000002-0000-0000-0000-000000000002",
      state: "Arunachal Pradesh",
      district: "Papum Pare",
      language_pref: "hi"
    },
    {
      id: "usr-cmdr-03-sikkim",
      role: "field_officer",
      name: "Field Master 3",
      email: "commander.sikkim@bhoomirakshak.gov.in",
      phone: "+919876500003",
      password: "SikkimCommander2026!",
      region_id: "b0000003-0000-0000-0000-000000000003",
      state: "Sikkim",
      district: "North Sikkim",
      language_pref: "en"
    },
    {
      id: "usr-cmdr-04-meghalaya",
      role: "field_officer",
      name: "Field Master 4",
      email: "commander.meghalaya@bhoomirakshak.gov.in",
      phone: "+919876500004",
      password: "MeghalayaCommander2026!",
      region_id: "b0000004-0000-0000-0000-000000000004",
      state: "Meghalaya",
      district: "East Khasi Hills",
      language_pref: "en"
    },
    {
      id: "usr-cmdr-05-mizoram",
      role: "field_officer",
      name: "Field Master 5",
      email: "commander.mizoram@bhoomirakshak.gov.in",
      phone: "+919876500005",
      password: "MizoramCommander2026!",
      region_id: "b0000005-0000-0000-0000-000000000005",
      state: "Mizoram",
      district: "Aizawl",
      language_pref: "en"
    },
    {
      id: "usr-cmdr-06-nagaland",
      role: "field_officer",
      name: "Field Master 6",
      email: "commander.nagaland@bhoomirakshak.gov.in",
      phone: "+919876500006",
      password: "NagalandCommander2026!",
      region_id: "b0000006-0000-0000-0000-000000000006",
      state: "Nagaland",
      district: "Kohima",
      language_pref: "en"
    },
    {
      id: "usr-cmdr-07-manipur",
      role: "field_officer",
      name: "Field Master 7",
      email: "commander.manipur@bhoomirakshak.gov.in",
      phone: "+919876500007",
      password: "ManipurCommander2026!",
      region_id: "b0000007-0000-0000-0000-000000000007",
      state: "Manipur",
      district: "Senapati",
      language_pref: "hi"
    },
    {
      id: "usr-cmdr-08-tripura",
      role: "field_officer",
      name: "Field Master 8",
      email: "commander.tripura@bhoomirakshak.gov.in",
      phone: "+919876500008",
      password: "TripuraCommander2026!",
      region_id: "b0000008-0000-0000-0000-000000000008",
      state: "Tripura",
      district: "Dhalai",
      language_pref: "bn"
    }
  ]
};

export async function seedNERCommanders() {
  console.log('=======================================================');
  console.log('🛡️  Seeding BhoomiRakshak 8 NER Regions + 1 Admin + 8 Field Commanders');
  console.log('=======================================================');

  // 1. Seed Regions in localDB
  const regionsTable = localDB.getTable('regions');
  for (const reg of NER_REGIONS) {
    const idx = regionsTable.findIndex(r => r.id === reg.id || (r.district === reg.district && r.state === reg.state));
    const now = new Date().toISOString();
    const regionRecord = {
      ...reg,
      created_at: now,
      updated_at: now
    };
    if (idx >= 0) {
      regionsTable[idx] = { ...regionsTable[idx], ...regionRecord };
    } else {
      regionsTable.push(regionRecord);
    }

    // Sync to Supabase if available
    if (isSupabaseConfigured && supabase) {
      try {
        const ring = reg.geometry.coordinates[0];
        const wktPoints = ring.map(([lon, lat]) => `${lon} ${lat}`).join(', ');
        const wkt = `POLYGON((${wktPoints}))`;
        await supabase.from('regions').upsert({
          id: reg.id,
          name: reg.name,
          state: reg.state,
          district: reg.district,
          boundary: wkt
        });
      } catch (err) {
        console.warn(`[SUPABASE] Region '${reg.name}' sync note:`, err.message);
      }
    }
  }
  localDB.save();
  console.log(`✅ ${NER_REGIONS.length} NER State Monitored Corridors provisioned.`);

  // 2. Seed / Update 1 Admin
  const usersTable = localDB.getTable('users');
  const adminDef = SEED_CREDENTIALS.admin;
  const adminHash = await bcrypt.hash(adminDef.password, 10);
  
  // Keep strictly registered citizen users; purge any old demo accounts
  const commanderIds = new Set(SEED_CREDENTIALS.commanders.map(c => c.id));
  const commanderEmails = new Set(SEED_CREDENTIALS.commanders.map(c => c.email));
  const preservedUsers = usersTable.filter(u => 
    u.role === 'citizen' && 
    u.email !== adminDef.email && 
    !commanderIds.has(u.id) && 
    !commanderEmails.has(u.email)
  );
  const now = new Date().toISOString();

  const isQaTestMode = process.env.QA_TEST_MODE === 'true' || process.env.TEST_MODE === 'true';
  const effectiveAdminPhone = isQaTestMode && process.env.TEST_ADMIN_PHONE
    ? `+91${process.env.TEST_ADMIN_PHONE.replace(/\D/g, '').slice(-10)}`
    : adminDef.phone;
  const effectiveOfficerPhone = isQaTestMode && process.env.TEST_FIELD_OFFICER_PHONE
    ? `+91${process.env.TEST_FIELD_OFFICER_PHONE.replace(/\D/g, '').slice(-10)}`
    : null;

  const adminRecord = {
    id: adminDef.id,
    role: 'admin',
    name: adminDef.name,
    email: adminDef.email,
    phone: effectiveAdminPhone,
    phone_verified: true,
    sms_enabled: true,
    password_hash: adminHash,
    region_id: null,
    region_ids: [],
    language_pref: adminDef.language_pref,
    is_active: true,
    created_at: now
  };

  usersTable.length = 0;
  usersTable.push(...preservedUsers, adminRecord);

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: existingAdminProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .maybeSingle();

      const targetAdminId = existingAdminProfile ? existingAdminProfile.id : adminDef.id;
      await supabase.from('profiles').upsert({
        id: targetAdminId,
        role: 'admin',
        full_name: adminDef.name,
        phone: effectiveAdminPhone,
        language_pref: 'en',
        sms_enabled: true,
        push_enabled: true
      });
    } catch (err) {
      console.warn('[SUPABASE] Admin profile upsert note:', err.message);
    }
  }
  console.log(`✅ Master Administrator provisioned: ${adminDef.email}`);

  // 3. Seed 8 Field Masters / Sector Commanders
  for (const cmdr of SEED_CREDENTIALS.commanders) {
    const cmdrHash = await bcrypt.hash(cmdr.password, 10);
    const cmdrPhone = effectiveOfficerPhone || cmdr.phone;
    const cmdrRecord = {
      id: cmdr.id,
      role: 'field_officer',
      name: cmdr.name,
      email: cmdr.email,
      phone: cmdrPhone,
      phone_verified: true,
      sms_enabled: true,
      password_hash: cmdrHash,
      region_id: cmdr.region_id,
      region_ids: [cmdr.region_id],
      state: cmdr.state,
      district: cmdr.district,
      language_pref: cmdr.language_pref,
      is_active: true,
      created_at: now
    };

    usersTable.push(cmdrRecord);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('profiles').upsert({
          id: cmdr.id,
          role: 'field_officer',
          full_name: cmdr.name,
          phone: cmdrPhone,
          region_id: cmdr.region_id,
          language_pref: cmdr.language_pref,
          phone_verified: true,
          sms_enabled: true
        });
      } catch (err) {
        console.warn(`[SUPABASE] Commander '${cmdr.name}' sync note:`, err.message);
      }
    }
  }

  localDB.save();
  console.log(`✅ All 8 NER Field Sector Commanders successfully deployed.`);
  console.log('=======================================================');
}

// Run if called directly
if (process.argv[1]?.includes('seed_ner_commanders.js')) {
  seedNERCommanders().then(() => process.exit(0)).catch(err => {
    console.error('Seed Error:', err);
    process.exit(1);
  });
}
