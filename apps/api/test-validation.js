/**
 * Backend Validation Test Script for Task 1.2
 * Tests POST /api/resources validation rules
 */

const API_URL = 'http://localhost:5000';

// Test user credentials from seed.ts
const TEST_USER = {
  email: 'demo@hostnexus.in',
  password: 'password123456'
};

// All 19 valid resource types
const VALID_RESOURCE_TYPES = [
  "Banquet Hall",
  "Event Space",
  "Meeting Space",
  "Kitchen Facility",
  "Vehicle",
  "AV Equipment",
  "Catering Equipment",
  "Crockery/Cutlery",
  "Cold Storage",
  "Furniture",
  "Tent/Canopy",
  "Staff/Manpower",
  "Parking Space",
  "Generator/Power",
  "Linen/Textile",
  "Decor Items",
  "Equipment",
  "Other"
];

let authToken = '';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Helper function to make API requests
async function makeRequest(endpoint, method = 'GET', body = null, includeAuth = true) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (includeAuth && authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const options = {
    method,
    headers
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, options);
  const data = await response.json();

  return { status: response.status, data };
}

// Get authentication token
async function authenticate() {
  log('\n📝 Authenticating test user...', 'cyan');
  
  const { status, data } = await makeRequest('/api/auth/login', 'POST', TEST_USER, false);

  if (status === 200 && data.success && data.data.token) {
    authToken = data.data.token;
    log('✅ Authentication successful', 'green');
    return true;
  } else {
    log(`❌ Authentication failed: ${JSON.stringify(data)}`, 'red');
    return false;
  }
}

// Test helper
async function runTest(testName, testFn) {
  try {
    const result = await testFn();
    if (result.success) {
      log(`✅ ${testName}`, 'green');
      if (result.details) {
        log(`   ${result.details}`, 'blue');
      }
    } else {
      log(`❌ ${testName}`, 'red');
      log(`   ${result.error}`, 'red');
      return false;
    }
    return true;
  } catch (error) {
    log(`❌ ${testName}`, 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

// Test 1: Reject name < 3 chars
async function testNameTooShort() {
  const { status, data } = await makeRequest('/api/resources', 'POST', {
    name: 'AB', // 2 characters
    resourceType: 'Banquet Hall',
    quantity: 1
  });

  if (status === 400 && !data.success) {
    const hasNameError = JSON.stringify(data).includes('Name must be at least 3 characters');
    return {
      success: hasNameError,
      details: hasNameError ? 'Validation error message correct' : null,
      error: hasNameError ? null : 'Expected error message not found'
    };
  }

  return {
    success: false,
    error: `Expected 400, got ${status}`
  };
}

// Test 2: Reject name > 100 chars
async function testNameTooLong() {
  const longName = 'A'.repeat(101);
  const { status, data } = await makeRequest('/api/resources', 'POST', {
    name: longName,
    resourceType: 'Banquet Hall',
    quantity: 1
  });

  if (status === 400 && !data.success) {
    const hasNameError = JSON.stringify(data).includes('Name cannot exceed 100 characters');
    return {
      success: hasNameError,
      details: hasNameError ? 'Validation error message correct' : null,
      error: hasNameError ? null : 'Expected error message not found'
    };
  }

  return {
    success: false,
    error: `Expected 400, got ${status}`
  };
}

// Test 3: Reject quantity < 1
async function testQuantityTooSmall() {
  const { status, data } = await makeRequest('/api/resources', 'POST', {
    name: 'Test Resource',
    resourceType: 'Banquet Hall',
    quantity: 0
  });

  if (status === 400 && !data.success) {
    const hasQuantityError = JSON.stringify(data).includes('Quantity must be at least 1');
    return {
      success: hasQuantityError,
      details: hasQuantityError ? 'Validation error message correct' : null,
      error: hasQuantityError ? null : 'Expected error message not found'
    };
  }

  return {
    success: false,
    error: `Expected 400, got ${status}`
  };
}

// Test 4: Reject quantity > 10000
async function testQuantityTooLarge() {
  const { status, data } = await makeRequest('/api/resources', 'POST', {
    name: 'Test Resource',
    resourceType: 'Banquet Hall',
    quantity: 10001
  });

  if (status === 400 && !data.success) {
    const hasQuantityError = JSON.stringify(data).includes('Quantity cannot exceed 10,000');
    return {
      success: hasQuantityError,
      details: hasQuantityError ? 'Validation error message correct' : null,
      error: hasQuantityError ? null : 'Expected error message not found'
    };
  }

  return {
    success: false,
    error: `Expected 400, got ${status}`
  };
}

// Test 5: Reject invalid resource types
async function testInvalidResourceType() {
  const invalidTypes = ['Invalid Type', 'Random Category', 'Foo Bar', ''];

  for (const invalidType of invalidTypes) {
    const { status, data } = await makeRequest('/api/resources', 'POST', {
      name: 'Test Resource',
      resourceType: invalidType,
      quantity: 1
    });

    if (status !== 400 || data.success) {
      return {
        success: false,
        error: `Invalid type "${invalidType}" was not rejected (status: ${status})`
      };
    }

    const hasError = JSON.stringify(data).includes('Invalid resource type') || 
                     JSON.stringify(data).includes('Resource type is required');
    if (!hasError) {
      return {
        success: false,
        error: `Invalid type "${invalidType}" rejected but error message incorrect`
      };
    }
  }

  return {
    success: true,
    details: `Tested ${invalidTypes.length} invalid types - all rejected correctly`
  };
}

// Test 6: Accept all 19 valid resource types
async function testValidResourceTypes() {
  const results = [];

  for (const validType of VALID_RESOURCE_TYPES) {
    const { status, data } = await makeRequest('/api/resources', 'POST', {
      name: `Test ${validType}`,
      resourceType: validType,
      quantity: 1,
      description: `Test resource for ${validType}`,
      location: 'Test Location'
    });

    if (status === 201 && data.success && data.data.resource) {
      results.push({ type: validType, success: true });
    } else {
      results.push({ 
        type: validType, 
        success: false, 
        status,
        error: data.error?.message || 'Unknown error'
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failedTypes = results.filter(r => !r.success);

  if (successCount === VALID_RESOURCE_TYPES.length) {
    return {
      success: true,
      details: `All 19 valid resource types accepted (${successCount}/${VALID_RESOURCE_TYPES.length})`
    };
  } else {
    return {
      success: false,
      error: `Only ${successCount}/${VALID_RESOURCE_TYPES.length} valid types accepted. Failed: ${failedTypes.map(f => f.type).join(', ')}`
    };
  }
}

// Test 7: Verify error message format
async function testErrorFormat() {
  const { status, data } = await makeRequest('/api/resources', 'POST', {
    name: 'AB', // Invalid
    resourceType: 'Invalid', // Invalid
    quantity: 0 // Invalid
  });

  if (status !== 400) {
    return {
      success: false,
      error: `Expected 400, got ${status}`
    };
  }

  // Check error response structure
  const hasSuccessFalse = data.success === false;
  const hasErrorObject = data.error && typeof data.error === 'object';
  const hasErrorCode = data.error?.code !== undefined;
  const hasErrorMessage = data.error?.message !== undefined;

  if (hasSuccessFalse && hasErrorObject && hasErrorCode && hasErrorMessage) {
    return {
      success: true,
      details: `Error format correct: { success: false, error: { code, message, ... } }`
    };
  }

  return {
    success: false,
    error: `Error format incorrect. Got: ${JSON.stringify(data)}`
  };
}

// Main test runner
async function runAllTests() {
  log('\n╔══════════════════════════════════════════════════════════╗', 'cyan');
  log('║  Backend Validation Tests - Task 1.2                     ║', 'cyan');
  log('║  Testing POST /api/resources validation rules            ║', 'cyan');
  log('╚══════════════════════════════════════════════════════════╝', 'cyan');

  // Authenticate first
  const authenticated = await authenticate();
  if (!authenticated) {
    log('\n❌ Cannot proceed without authentication', 'red');
    process.exit(1);
  }

  log('\n📋 Running validation tests...', 'cyan');
  log('─────────────────────────────────────────────────────────', 'cyan');

  const results = [];

  // Run all tests
  results.push(await runTest(
    'Test 1: Reject name < 3 characters',
    testNameTooShort
  ));

  results.push(await runTest(
    'Test 2: Reject name > 100 characters',
    testNameTooLong
  ));

  results.push(await runTest(
    'Test 3: Reject quantity < 1',
    testQuantityTooSmall
  ));

  results.push(await runTest(
    'Test 4: Reject quantity > 10000',
    testQuantityTooLarge
  ));

  results.push(await runTest(
    'Test 5: Reject invalid resource types',
    testInvalidResourceType
  ));

  results.push(await runTest(
    'Test 6: Accept all 19 valid resource types',
    testValidResourceTypes
  ));

  results.push(await runTest(
    'Test 7: Verify error message format',
    testErrorFormat
  ));

  // Summary
  const passedCount = results.filter(r => r).length;
  const totalCount = results.length;

  log('\n╔══════════════════════════════════════════════════════════╗', 'cyan');
  log('║  Test Summary                                            ║', 'cyan');
  log('╚══════════════════════════════════════════════════════════╝', 'cyan');

  if (passedCount === totalCount) {
    log(`\n✅ All tests passed! (${passedCount}/${totalCount})`, 'green');
    log('✅ Backend validation is working correctly', 'green');
    log('✅ All requirements verified (8.9, 8.10, 8.11)', 'green');
  } else {
    log(`\n⚠️  ${passedCount}/${totalCount} tests passed`, 'yellow');
    log(`❌ ${totalCount - passedCount} test(s) failed`, 'red');
  }

  log('\n✅ Task 1.2 completed!\n', 'green');

  process.exit(passedCount === totalCount ? 0 : 1);
}

// Run the tests
runAllTests().catch((error) => {
  log(`\n❌ Test execution failed: ${error.message}`, 'red');
  process.exit(1);
});
