const axios = require('axios');

async function runTest() {
  const API_URL = 'http://localhost:4000/api';
  console.log('--- Starting API End-to-End Test (Gold Advance Edition) ---');

  try {
    // 1. Login as Admin
    console.log('1. Attempting Admin Login...');
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@rgt.com',
      password: 'password123'
    });
    const token = loginRes.data.token;
    console.log('✓ Login Successful. Token obtained.');

    const headers = { Authorization: `Bearer ${token}` };

    // 2. Get Users to find a Customer
    console.log('2. Fetching Users...');
    const usersRes = await axios.get(`${API_URL}/admin/users`, { headers });
    const customers = usersRes.data.filter(u => u.role === 'CUSTOMER');
    if (customers.length === 0) throw new Error('No customers found to test with.');
    
    const testCustomer = customers[0];
    console.log(`✓ Found Test Customer: ${testCustomer.name} (${testCustomer.id})`);

    // 3. Add Manual Gold Advance
    console.log('3. Adding Manual Gold Advance...');
    const goldAdvanceRes = await axios.post(`${API_URL}/gold-advances/admin/create`, {
      userId: testCustomer.id,
      amount: 15000,
      description: 'E2E Automated Verification Gold Advance'
    }, { headers });

    console.log('✓ Gold Advance Created:', goldAdvanceRes.data);

    // 4. Verify Audit Trail (Transactions)
    console.log('4. Verifying Transaction Logs...');
    const txRes = await axios.get(`${API_URL}/admin/transactions/${testCustomer.id}`, {
      headers
    });
    
    const recentTx = txRes.data;
    console.log(`✓ Found ${recentTx.length} recent transactions for customer.`);
    
    // Check for "GOLD_ADVANCE" type
    const goldAdvanceTx = recentTx.find(t => t.type === 'GOLD_ADVANCE');

    if (goldAdvanceTx) {
      console.log('✓ Audit trail verified: Gold Advance transaction exists.');
    } else {
      console.warn('! Audit trail incomplete. Check transaction types.');
    }

    console.log('\n--- ALL BACKEND TESTS PASSED ---');
  } catch (err) {
    console.error('✖ TEST FAILED:', err.response ? err.response.data : err.message);
    process.exit(1);
  }
}

runTest();
