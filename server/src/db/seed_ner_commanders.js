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

// 2. The 1 Administrator + 8 Field Masters / Sector Commanders Definitions + Registered Citizens
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
      id: "c27053d1-d759-43e0-8f3e-a8e577211850",
      legacy_id: "usr-cmdr-01-assam",
      role: "field_officer",
      name: "Kailas Sadashiv Mutkule",
      email: "kailasmutkule99@gmail.com",
      phone: "+919699721767",
      password: "9699721767",
      region_id: "ad2a2d14-f0c0-42eb-ac4a-23a7a42abcf5",
      state: "Assam",
      district: "Dima Hasao",
      corridor: "Lumding-Haflong-Badarpur NH-27 Corridor",
      language_pref: "as"
    },
    {
      id: "830fdcf7-3f56-437f-a05c-e36c5bb4184e",
      legacy_id: "usr-cmdr-02-arunachal",
      role: "field_officer",
      name: "Adhishree Gajanan Sukalkar",
      email: "adishreesukalkar53@gmail.com",
      phone: "+918010986532",
      password: "8010986532",
      region_id: "b0000002-0000-0000-0000-000000000002",
      state: "Arunachal Pradesh",
      district: "Papum Pare",
      corridor: "Papum Pare Foothills NH-415 Corridor",
      language_pref: "hi"
    },
    {
      id: "8cb33128-88c2-4b40-9842-4527f8e3e142",
      legacy_id: "usr-cmdr-03-sikkim",
      role: "field_officer",
      name: "Harsh Umesh Hatti",
      email: "harshhatti291@gmail.com",
      phone: "+919518597050",
      password: "9518597050",
      region_id: "b0000003-0000-0000-0000-000000000003",
      state: "Sikkim",
      district: "North Sikkim",
      corridor: "Mangan-Gangtok Teesta Valley NH-10 Corridor",
      language_pref: "en"
    },
    {
      id: "76309451-5301-4bbe-934a-4ca5e99bd4d3",
      legacy_id: "usr-cmdr-04-meghalaya",
      role: "field_officer",
      name: "Manav Ratan Agrawal",
      email: "agrawalmanav83@gmail.com",
      phone: "+918625816246",
      password: "8625816246",
      region_id: "b0000004-0000-0000-0000-000000000004",
      state: "Meghalaya",
      district: "East Khasi Hills",
      corridor: "Shillong-Cherrapunji Escarpment NH-6 Corridor",
      language_pref: "en"
    },
    {
      id: "1d8cce73-2ed5-42a7-8119-89d04c2f1267",
      legacy_id: "usr-cmdr-05-mizoram",
      role: "field_officer",
      name: "Ritika Suresh Gogawale",
      email: "ritikagogawale14@gmail.com",
      phone: "+919623895456",
      password: "9623895456",
      region_id: "b0000005-0000-0000-0000-000000000005",
      state: "Mizoram",
      district: "Aizawl",
      corridor: "Aizawl North - Durtlang Ridge NH-54 Corridor",
      language_pref: "en"
    },
    {
      id: "870f9f21-413b-4830-b309-4393a90604fc",
      legacy_id: "usr-cmdr-06-nagaland",
      role: "field_officer",
      name: "pratham prasad buran",
      email: "comp24_pratham.buran@isbmcoe.org",
      phone: "+919067372943",
      password: "9067372943",
      region_id: "b0000006-0000-0000-0000-000000000006",
      state: "Nagaland",
      district: "Kohima",
      corridor: "Dimapur-Kohima Range NH-29 Corridor",
      language_pref: "en"
    },
    {
      id: "8725f1fb-33f0-41d3-989d-0fa380d91020",
      legacy_id: "usr-cmdr-07-manipur",
      role: "field_officer",
      name: "Amar",
      email: "comp24_amarnath.budhwat@isbmcoe.org",
      phone: "+919922387625",
      password: "9922387625",
      region_id: "b0000007-0000-0000-0000-000000000007",
      state: "Manipur",
      district: "Senapati",
      corridor: "Senapati-Imphal Valley NH-2 Corridor",
      language_pref: "hi"
    },
    {
      id: "7dacb6d4-fd59-4581-92a3-a864fc692d74",
      legacy_id: "usr-cmdr-08-tripura",
      role: "field_officer",
      name: "sanskar mule",
      email: "comp24_sanskar.mule@isbmcoe.org",
      phone: "+918446222041",
      password: "8446222041",
      region_id: "b0000008-0000-0000-0000-000000000008",
      state: "Tripura",
      district: "Dhalai",
      corridor: "Ambassa-Manu Hill Ranges NH-8 Corridor",
      language_pref: "bn"
    }
  ],
  citizens: [
    {
      id: "8d5d42cb-46e0-498d-9849-48d7641a383a",
      role: "citizen",
      name: "pb",
      email: "pbstorefile@gmail.com",
      phone: "9021158105",
      password: "9021158105",
      region_id: "ad2a2d14-f0c0-42eb-ac4a-23a7a42abcf5",
      state: "Assam",
      district: "Dima Hasao"
    },
    {
      id: "319abd4b-9544-4a69-bc28-282383649dfb",
      role: "citizen",
      name: "Haflong Resident Observer",
      email: "citizen.haflong@bhoomirakshak.gov.in",
      phone: "+919876543212",
      password: "9876543212",
      region_id: "ad2a2d14-f0c0-42eb-ac4a-23a7a42abcf5",
      state: "Assam",
      district: "Dima Hasao"
    },
    {
      id: "a3f7814a-29e1-4057-b5f0-f7382e9abb4c",
      role: "citizen",
      name: "Pratham Buran",
      email: "prathamburan72pb@gmail.com",
      phone: "+919067372943",
      password: "9067372943",
      region_id: "b0000006-0000-0000-0000-000000000006",
      state: "Nagaland",
      district: "Kohima"
    },
    {
      id: "1ed1d716-b4fa-4103-a777-760d234811f5",
      role: "citizen",
      name: "Kailas Mutkule",
      email: "kailas@gmail.com",
      phone: "+919699721767",
      password: "9699721767",
      region_id: "ad2a2d14-f0c0-42eb-ac4a-23a7a42abcf5",
      state: "Assam",
      district: "Dima Hasao"
    }
  ]
};

export async function seedNERCommanders() {
  console.log('=======================================================');
  console.log('🛡️  Seeding BhoomiRakshak 8 NER Regions + 1 Admin + 8 Field Masters + Citizens');
  console.log('=======================================================');

  // 1. Seed Regions in localDB
  const regionsTable = localDB.getTable('regions');
  for (const reg of NER_REGIONS) {
    const idx = regionsTable.findIndex(r => r.id === reg.id || (r.district === reg.district && r.state === reg.state));
    const regionRecord = {
      id: reg.id,
      name: reg.name,
      state: reg.state,
      district: reg.district,
      center: reg.center,
      risk_level: reg.risk_level,
      slope_deg: reg.slope_deg,
      elevation_m: reg.elevation_m,
      soil_saturation: reg.soil_saturation,
      geometry: reg.geometry,
      created_at: new Date().toISOString()
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
  
  // Keep strictly registered citizen users; purge any old mock accounts
  const commanderIds = new Set(SEED_CREDENTIALS.commanders.map(c => c.id));
  const commanderEmails = new Set(SEED_CREDENTIALS.commanders.map(c => c.email.toLowerCase()));
  const preservedUsers = usersTable.filter(u => 
    u.role === 'citizen' && 
    u.email !== adminDef.email && 
    !commanderIds.has(u.id) && 
    !commanderEmails.has(u.email?.toLowerCase())
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
    const cmdrPhone = cmdr.phone;
    const cmdrRecord = {
      id: cmdr.id,
      legacy_id: cmdr.legacy_id,
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
      corridor: cmdr.corridor,
      language_pref: cmdr.language_pref,
      is_active: true,
      created_at: now
    };

    usersTable.push(cmdrRecord);

    if (isSupabaseConfigured && supabase) {
      try {
        // Upsert in Supabase profiles
        await supabase.from('profiles').upsert({
          id: cmdr.id,
          role: 'field_officer',
          full_name: cmdr.name,
          phone: cmdrPhone,
          region_id: cmdr.region_id,
          language_pref: cmdr.language_pref,
          sms_enabled: true,
          push_enabled: true
        });

        // Sync or update in Supabase Auth (auth.users)
        try {
          const { data: userCheck } = await supabase.auth.admin.getUserById(cmdr.id);
          if (userCheck?.user) {
            await supabase.auth.admin.updateUserById(cmdr.id, {
              email: cmdr.email,
              password: cmdr.password,
              email_confirm: true,
              user_metadata: { role: 'field_officer', full_name: cmdr.name, phone: cmdrPhone }
            });
          } else {
            await supabase.auth.admin.createUser({
              id: cmdr.id,
              email: cmdr.email,
              password: cmdr.password,
              email_confirm: true,
              user_metadata: { role: 'field_officer', full_name: cmdr.name, phone: cmdrPhone }
            });
          }
        } catch (authErr) {
          console.warn(`[SUPABASE AUTH] Commander '${cmdr.name}' sync note:`, authErr.message);
        }
      } catch (err) {
        console.warn(`[SUPABASE] Commander '${cmdr.name}' sync note:`, err.message);
      }
    }
  }

  // 4. Seed Registered Citizens
  for (const cit of SEED_CREDENTIALS.citizens) {
    const citHash = await bcrypt.hash(cit.password, 10);
    const citRecord = {
      id: cit.id,
      role: 'citizen',
      name: cit.name,
      email: cit.email,
      phone: cit.phone,
      phone_verified: true,
      sms_enabled: true,
      password_hash: citHash,
      region_id: cit.region_id,
      region_ids: [cit.region_id],
      state: cit.state,
      district: cit.district,
      is_active: true,
      created_at: now
    };

    const existingIdx = usersTable.findIndex(u => u.id === cit.id || (u.email && u.email.toLowerCase() === cit.email.toLowerCase()));
    if (existingIdx >= 0) {
      usersTable[existingIdx] = { ...usersTable[existingIdx], ...citRecord };
    } else {
      usersTable.push(citRecord);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('profiles').upsert({
          id: cit.id,
          role: 'citizen',
          full_name: cit.name,
          phone: cit.phone,
          region_id: cit.region_id,
          sms_enabled: true,
          push_enabled: true
        });

        try {
          const { data: userCheck } = await supabase.auth.admin.getUserById(cit.id);
          if (userCheck?.user) {
            await supabase.auth.admin.updateUserById(cit.id, {
              email: cit.email,
              password: cit.password,
              email_confirm: true,
              user_metadata: { role: 'citizen', full_name: cit.name, phone: cit.phone }
            });
          } else {
            await supabase.auth.admin.createUser({
              id: cit.id,
              email: cit.email,
              password: cit.password,
              email_confirm: true,
              user_metadata: { role: 'citizen', full_name: cit.name, phone: cit.phone }
            });
          }
        } catch (authErr) {
          console.warn(`[SUPABASE AUTH] Citizen '${cit.name}' sync note:`, authErr.message);
        }
      } catch (err) {
        console.warn(`[SUPABASE] Citizen '${cit.name}' sync note:`, err.message);
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
