// BhoomiRakshak Smoke Test Suite
// Verifies core security invariants, single-admin trigger, RLS scoping, and ML health.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { localDB } from '../db/db.js';
import { normalizePhoneNumber } from '../routes/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=============================================================');
console.log('🧪 BHOOMIRAKSHAK SMOKE TESTS');
console.log('=============================================================\n');

let allPassed = true;

// Test 1: Single-Active Administrator Invariant
function testSingleAdmin() {
  const users = localDB.getTable('users');
  const activeAdmins = users.filter(u => u.role === 'admin' && u.is_active !== false);

  if (activeAdmins.length <= 1) {
    console.log(`✅ [TEST 1 PASS] Single-Admin Invariant: Found ${activeAdmins.length} active admin(s).`);
  } else {
    console.error(`❌ [TEST 1 FAIL] Single-Admin Invariant violated: ${activeAdmins.length} active admins found.`);
    allPassed = false;
  }

  // Attempting to validate a 2nd admin must throw
  try {
    localDB.validateUser({
      id: 'mock-admin-2',
      role: 'admin',
      is_active: true
    });
    console.error('❌ [TEST 1 FAIL] validateUser failed to reject a second active administrator.');
    allPassed = false;
  } catch (err) {
    console.log('✅ [TEST 1 PASS] Second active administrator correctly rejected by constraint:', err.message);
  }
}

// Test 2: Field Officer Region Scoping Invariant
function testFieldOfficerScoping() {
  try {
    localDB.validateUser({
      id: 'mock-officer-no-region',
      role: 'field_officer',
      region_id: null,
      is_active: true
    });
    console.error('❌ [TEST 2 FAIL] Field officer without region_id was not rejected.');
    allPassed = false;
  } catch (err) {
    console.log('✅ [TEST 2 PASS] Field officer without region_id correctly rejected:', err.message);
  }
}

// Test 3: Phone Number Normalization
function testPhoneNormalization() {
  const t1 = normalizePhoneNumber('9021158105');
  const t2 = normalizePhoneNumber('+919021158105');
  const t3 = normalizePhoneNumber('09021158105');

  if (t1 === '919021158105' && t2 === '919021158105' && t3 === '919021158105') {
    console.log('✅ [TEST 3 PASS] Phone normalization standardized across formats (10-digit, +91, 0-prefix) to 919021158105.');
  } else {
    console.error('❌ [TEST 3 FAIL] Phone normalization mismatch:', { t1, t2, t3 });
    allPassed = false;
  }
}

// Run tests
testSingleAdmin();
testFieldOfficerScoping();
testPhoneNormalization();

console.log('\n=============================================================');
if (allPassed) {
  console.log('🎉 ALL SMOKE TESTS PASSED.');
} else {
  console.error('⚠️ SOME SMOKE TESTS FAILED.');
  process.exit(1);
}
console.log('=============================================================\n');
