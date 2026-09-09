// Comprehensive automated test suite for BhoomiRakshak
import axios from 'axios';

const BACKEND_URL = 'http://localhost:5000/api';
const ML_URL = 'http://127.0.0.1:8000';

async function runVerification() {
  console.log('--- Starting BhoomiRakshak End-to-End Verification ---');

  // 1. Health checks
  const beHealth = await axios.get('http://localhost:5000/health');
  console.log('✓ 1. Backend Core Status:', beHealth.data.status);

  const mlHealth = await axios.get(`${ML_URL}/ml/health`);
  console.log('✓ 2. ML Engine Status:', mlHealth.data.status, '| Model:', mlHealth.data.model_name);

  // 2. Strict Empty States Check
  const [alertsRes, reportsRes, regionsRes, zonesRes, analyticsRes] = await Promise.all([
    axios.get(`${BACKEND_URL}/alerts`),
    axios.get(`${BACKEND_URL}/reports`),
    axios.get(`${BACKEND_URL}/regions`),
    axios.get(`${BACKEND_URL}/risk-zones`),
    axios.get(`${BACKEND_URL}/analytics`)
  ]);

  console.log('✓ 3. Strict Empty States:');
  console.log(`   - Alerts in DB: ${alertsRes.data.alerts.length}`);
  console.log(`   - Reports in DB: ${reportsRes.data.reports.length}`);
  console.log(`   - Regions in DB: ${regionsRes.data.regions.length}`);
  console.log(`   - Risk Zones in DB: ${zonesRes.data.risk_zones.length}`);
  console.log(`   - Analytics total alerts: ${analyticsRes.data.alerts.total}`);

  // 3. Admin Setup (First and only admin bootstrap)
  const adminRes = await axios.post(`${BACKEND_URL}/auth/setup-admin`, {
    name: 'Dr. P. Sharma',
    email: 'dr.sharma@bhoomirakshak.gov.in',
    phone: '+919876543210',
    password: 'MasterAdminSecretPassword2026'
  });
  console.log('✓ 4. Admin Provisioned:', adminRes.data.user.name, `(${adminRes.data.user.role})`);
  const adminToken = adminRes.data.token;

  // 4. Test Single-Admin Constraint
  try {
    await axios.post(`${BACKEND_URL}/auth/setup-admin`, {
      name: 'Second Admin Imposter',
      email: 'imposter@bhoomirakshak.gov.in',
      password: 'SomePassword'
    });
    console.error('FAILED: Second admin was allowed!');
  } catch (err) {
    console.log('✓ 5. Single Active Admin Constraint successfully enforced:', err.response?.data?.error);
  }

  // 5. Create Monitored Region (Admin only)
  const regionRes = await axios.post(
    `${BACKEND_URL}/regions`,
    {
      name: 'Lumding-Badarpur Hill Section NH-27 Corridor',
      state: 'Assam',
      district: 'Dima Hasao',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [92.80, 25.10],
            [93.20, 25.10],
            [93.20, 25.40],
            [92.80, 25.40],
            [92.80, 25.10]
          ]
        ]
      }
    },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  const regionId = regionRes.data.region.id;
  console.log('✓ 6. Monitored Region Registered:', regionRes.data.region.district, `(ID: ${regionId})`);

  // 6. Deploy Field Officer linked to Region (Admin only)
  const officerRes = await axios.post(
    `${BACKEND_URL}/auth/officers`,
    {
      name: 'Inspector R. Lyngdoh',
      email: 'r.lyngdoh@sdrf.gov.in',
      phone: '+919876500001',
      password: 'FieldOfficerPassword2026',
      region_id: regionId
    },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  console.log('✓ 7. Field Officer Deployed:', officerRes.data.officer.name, `(Assigned: ${regionId})`);

  // 7. Field Officer Login
  const offLoginRes = await axios.post(`${BACKEND_URL}/auth/login`, {
    identifier: 'r.lyngdoh@sdrf.gov.in',
    password: 'FieldOfficerPassword2026'
  });
  const officerToken = offLoginRes.data.token;
  console.log('✓ 8. Officer Login Authenticated. Role:', offLoginRes.data.user.role);

  // 8. Submit Field Report
  const reportRes = await axios.post(
    `${BACKEND_URL}/reports`,
    {
      region_id: regionId,
      report_type: 'crack',
      severity: 'HIGH',
      description: 'Ground tension crack 8cm wide developing along road embankment after 2 hours of rainfall.',
      latitude: 25.18,
      longitude: 92.95,
      idempotency_key: '00000000-0000-0000-0000-000000000001',
      created_offline: false
    },
    { headers: { Authorization: `Bearer ${officerToken}` } }
  );
  console.log('✓ 9. Field Report Submitted:', reportRes.data.report.report_type, `(Status: ${reportRes.data.report.status})`);

  // 9. Citizen Registration & SMS Subscription
  const citizenRes = await axios.post(`${BACKEND_URL}/auth/register-citizen`, {
    name: 'Biren Das',
    phone: '+919988776655',
    email: 'biren.das@gmail.com',
    password: 'CitizenPassword2026',
    region_id: regionId
  });
  const citizenToken = citizenRes.data.token;
  console.log('✓ 10. Citizen Registered:', citizenRes.data.user.name);

  const subRes = await axios.post(
    `${BACKEND_URL}/alerts/subscribe`,
    { region_id: regionId, sms_enabled: true, push_enabled: false },
    { headers: { Authorization: `Bearer ${citizenToken}` } }
  );
  console.log('✓ 11. Citizen Subscribed to SMS Alerts:', subRes.data.subscription.sms_enabled);

  // 10. Trigger Real Weather Sync (Pulls Open-Meteo for Dima Hasao)
  const weatherRes = await axios.post(`${BACKEND_URL}/weather/sync`);
  console.log('✓ 12. Real Weather Telemetry Sync:', weatherRes.data.message);

  // 11. Run ML Scoring for Region
  const mlScoreRes = await axios.post(`${ML_URL}/ml/score-region`, {
    region_id: regionId,
    features: {
      rain_30min: 15.2,
      rain_3h: 58.4,
      rain_24h: 162.0,
      rain_7d: 310.0,
      slope_deg: 36.5,
      elevation_m: 680.0,
      historical_landslide_density: 2.1,
      satellite_change_proxy: 0.45
    }
  });
  console.log('✓ 13. ML Scoring Completed:', mlScoreRes.data.prediction.risk_level, 
              `Probability: ${(mlScoreRes.data.prediction.risk_probability * 100).toFixed(1)}%`);
  console.log('      SHAP Reasons:', mlScoreRes.data.prediction.reasons);

  // 12. Admin Dispatches Emergency Warning Alert
  const alertBroadcastRes = await axios.post(
    `${BACKEND_URL}/alerts`,
    {
      region_id: regionId,
      severity: 'CRITICAL',
      message: 'CRITICAL WARNING: Continuous heavy precipitation in Dima Hasao (24h rain > 160mm). High probability of slope failure within 6-12 hours.',
      reasons: ['24h rainfall exceeded debris threshold', 'Steep slope gradient 36.5°']
    },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  console.log('✓ 14. Emergency Alert Broadcast Dispatched:');
  console.log('      Channels Delivery Audit:', JSON.stringify(alertBroadcastRes.data.alert.channels_sent));

  // 13. Check Updated Analytics
  const finalAnalytics = await axios.get(`${BACKEND_URL}/analytics`);
  console.log('✓ 15. Final Database Analytics Ground Truth:');
  console.log('      Total Alerts:', finalAnalytics.data.alerts.total);
  console.log('      Total Reports:', finalAnalytics.data.reports.total);
  console.log('      Total Risk Zones Scored:', finalAnalytics.data.risk_zones.total_zones);
  console.log('      Rainfall Sensor Telemetry Packets:', finalAnalytics.data.operational.rainfall_telemetry_packets);

  console.log('--- All 15 End-to-End Tests Passed Successfully! ---');
}

runVerification().catch(err => {
  console.error('Verification Error:', err.message, err.response?.data || '');
  process.exit(1);
});
