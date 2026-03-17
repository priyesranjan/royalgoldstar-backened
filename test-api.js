const fetch = require('node-fetch');

async function testApi() {
  const base = 'http://localhost:4000/api';
  
  try {
    const health = await fetch(`${base}/health`).then(r => r.json());
    console.log('Health:', health);
    
    // Test referrals (will fail 401 without token, but shouldn't be 404)
    const referrals = await fetch(`${base}/referrals`);
    console.log('Referrals Status:', referrals.status);
    if (referrals.status === 404) {
      console.log('FAILED: /api/referrals is still 404');
    } else {
      console.log('PASSED: /api/referrals is NOT 404');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testApi();
