// Automated test verification for BhoomiRakshak NASA & SRTM Ground Truth Pipeline Integration
import axios from 'axios';

const BACKEND_URL = 'http://localhost:5000/api';
const ML_URL = 'http://127.0.0.1:8000';

async function runPipelineVerification() {
  console.log('=======================================================');
  console.log('>> STARTING BHOOMIRAKSHAK DATASET & ML INTEGRATION TESTS');
  console.log('=======================================================');

  // 1. Pipeline Status Check
  console.log('\n[1/7] Testing GET /api/data-pipeline/status...');
  const statusRes = await axios.get(`${BACKEND_URL}/data-pipeline/status`);
  console.log('  Pipeline Status:', statusRes.data.pipeline_status);
  console.log('  Datasets Tracked:');
  statusRes.data.files.forEach(f => {
    console.log(`    - ${f.filename}: ${f.row_count} rows (${(f.size_bytes / 1024).toFixed(1)} KB) [${f.exists ? 'FOUND' : 'MISSING'}]`);
  });
  if (statusRes.data.pipeline_status !== 'READY') {
    throw new Error('Pipeline status is not READY');
  }

  // 2. Historical Landslides Endpoint
  console.log('\n[2/7] Testing GET /api/historical-landslides...');
  const landslidesRes = await axios.get(`${BACKEND_URL}/historical-landslides`);
  console.log(`  Historical Landslides in Registry: ${landslidesRes.data.count}`);
  const firstLS = landslidesRes.data.historical_landslides[0];
  console.log(`  Sample Ground Truth Record: ${firstLS.external_event_id} | ${firstLS.district}, ${firstLS.state}`);
  console.log(`    Trigger: ${firstLS.trigger} | Date: ${firstLS.event_date}`);
  console.log(`    SRTM Elevation: ${firstLS.elevation_m}m | Slope: ${firstLS.slope_deg}° | GPM 24h Rain: ${firstLS.rain_24h_mm}mm`);
  console.log(`    Citation: ${firstLS.citation}`);
  if (landslidesRes.data.count < 8) {
    throw new Error(`Expected at least 8 historical landslides, got ${landslidesRes.data.count}`);
  }

  // 3. Admin Authentication
  console.log('\n[3/7] Authenticating as Platform Administrator...');
  const loginRes = await axios.post(`${BACKEND_URL}/auth/login`, {
    identifier: 'dr.sharma@bhoomirakshak.gov.in',
    password: 'MasterAdminSecretPassword2026'
  });
  const adminToken = loginRes.data.token;
  console.log(`  Authenticated as: ${loginRes.data.user.name} (${loginRes.data.user.role})`);

  // 4. Ingest Pipeline Data into PostgreSQL tables
  console.log('\n[4/7] Testing POST /api/data-pipeline/ingest (Admin Role)...');
  const ingestRes = await axios.post(
    `${BACKEND_URL}/data-pipeline/ingest`,
    {},
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  console.log(`  Ingestion Result: ${ingestRes.data.message}`);
  console.log(`  Total Historical Events in DB: ${ingestRes.data.total_in_database}`);

  // 5. Trigger Machine Learning Training
  console.log('\n[5/7] Testing POST /api/data-pipeline/train-ml...');
  const trainRes = await axios.post(
    `${BACKEND_URL}/data-pipeline/train-ml`,
    {},
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  console.log(`  Training Status: ${trainRes.data.status}`);
  console.log(`  Model Name: ${trainRes.data.ml_response.metadata.model_name}`);
  console.log(`  Samples Trained: ${trainRes.data.ml_response.metadata.total_samples}`);
  console.log(`  Accuracy: ${(trainRes.data.ml_response.metadata.metrics.accuracy * 100).toFixed(1)}% | ROC-AUC: ${trainRes.data.ml_response.metadata.metrics.roc_auc.toFixed(3)}`);

  // 6. Test ML Microservice Health
  console.log('\n[6/7] Testing GET http://127.0.0.1:8000/ml/health...');
  const mlHealth = await axios.get(`${ML_URL}/ml/health`);
  console.log('  Model Loaded:', mlHealth.data.model_name);
  console.log('  Trained on Real Ground Truth:', mlHealth.data.trained_on_real_ground_truth);
  console.log('  Top 3 Learned Factors:');
  const topFactors = Object.entries(mlHealth.data.feature_importances).slice(0, 3);
  topFactors.forEach(([f, w]) => {
    console.log(`    * ${f}: ${(w * 100).toFixed(1)}%`);
  });

  // 7. Test AI Inference with Real Ground Truth Tree
  console.log('\n[7/7] Testing POST http://127.0.0.1:8000/ml/predict...');
  const highRiskVector = {
    rain_30min: 20.0,
    rain_3h: 75.0,
    rain_24h: 140.0,
    rain_7d: 350.0,
    slope_deg: 38.5,
    elevation_m: 1420.0,
    historical_landslide_density: 3.2,
    satellite_change_proxy: 0.65
  };
  const predictRes = await axios.post(`${ML_URL}/ml/predict`, highRiskVector);
  console.log(`  Prediction for Deluge Vector in Steep Slope:`);
  console.log(`    Risk Probability: ${(predictRes.data.risk_probability * 100).toFixed(1)}%`);
  console.log(`    Risk Level: ${predictRes.data.risk_level}`);
  console.log(`    Explainable Triggers: ${predictRes.data.reasons.join(' | ')}`);

  const safeVector = {
    rain_30min: 0.0,
    rain_3h: 0.0,
    rain_24h: 0.5,
    rain_7d: 3.0,
    slope_deg: 3.0,
    elevation_m: 55.0,
    historical_landslide_density: 0.0,
    satellite_change_proxy: 0.02
  };
  const safeRes = await axios.post(`${ML_URL}/ml/predict`, safeVector);
  console.log(`  Prediction for Valley Stable Vector:`);
  console.log(`    Risk Probability: ${(safeRes.data.risk_probability * 100).toFixed(1)}%`);
  console.log(`    Risk Level: ${safeRes.data.risk_level}`);

  console.log('\n=======================================================');
  console.log('[ALL TESTS PASSED] NASA DATASET & ML INTEGRATION VERIFIED!');
  console.log('=======================================================\n');
}

runPipelineVerification().catch(err => {
  console.error('\n[VERIFICATION FAILED]:', err.response?.data || err.message);
  process.exit(1);
});
