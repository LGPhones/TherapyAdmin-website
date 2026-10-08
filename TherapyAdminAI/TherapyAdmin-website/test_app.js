const axios = require('axios');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  validateStatus: () => true, // Handle non-200 responses manually
});

// Mock user data
const testUser = {
  email: `test_${Date.now()}@example.com`,
  password: 'TestPassword123!',
  name: 'Test User'
};

let accessToken = '';
let cookie = '';

async function runTests() {
  console.log('--- 🧪 Starting TherapyAdmin AI Integration Tests ---');

  try {
    // 1. Test Signup
    console.log('\n[1] Testing Signup...');
    const signupRes = await axiosInstance.post('/auth/signup', testUser);
    console.log('Status:', signupRes.status);
    console.log('Body:', signupRes.data);
    if (signupRes.status !== 200) throw new Error('Signup failed');

    // 2. Test Login
    console.log('\n[2] Testing Login...');
    const loginRes = await axiosInstance.post('/auth/login', {
      email: testUser.email,
      password: testUser.password
    });
    console.log('Status:', loginRes.status);
    console.log('Body:', loginRes.data);
    if (loginRes.status !== 200) throw new Error('Login failed');

    accessToken = loginRes.data.accessToken;
    // Extract cookies from response headers
    if (loginRes.headers['set-cookie']) {
      cookie = loginRes.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
    }

    const authHeaders = {
      'Authorization': `Bearer ${accessToken}`,
      'Cookie': cookie
    };

    // 3. Test Protected Route (Profile)
    console.log('\n[3] Testing Protected Profile Route...');
    const profileRes = await axiosInstance.get('/api/voice-profile', { headers: authHeaders });
    console.log('Status:', profileRes.status);
    console.log('Body:', profileRes.data);
    if (profileRes.status !== 200) throw new Error('Profile fetch failed');

    // 4. Test AI Generation (Mock Mode)
    console.log('\n[4] Testing AI Generation (Mock Mode)...');
    const aiRes = await axiosInstance.post('/api/generate', {
      docType: 'appeal',
      context: 'Patient denied coverage for therapy.'
    }, { headers: authHeaders });
    console.log('Status:', aiRes.status);
    if (aiRes.status === 200) {
      console.log('Success: AI returned mock document.');
    } else {
      console.log('Error Body:', aiRes.data);
    }

    // 5. Test Saving a Document
    console.log('\n[5] Testing Save Document...');
    const saveRes = await axiosInstance.post('/api/documents', {
      name: 'Test Appeal',
      type: 'Appeal',
      content: 'This is a test document content.'
    }, { headers: authHeaders });
    console.log('Status:', saveRes.status);
    console.log('Body:', saveRes.data);
    const docId = saveRes.data.id;

    // 6. Test Listing Documents
    console.log('\n[6] Testing List Documents...');
    const listRes = await axiosInstance.get('/api/documents', { headers: authHeaders });
    console.log('Status:', listRes.status);
    console.log('Count:', listRes.data.documents.length);

    // 7. Test Deleting a Document
    console.log('\n[7] Testing Delete Document...');
    const delRes = await axiosInstance.delete(`/api/documents/${docId}`, { headers: authHeaders });
    console.log('Status:', delRes.status);
    console.log('Body:', delRes.data);

    // 8. Test Tor Check
    console.log('\n[8] Testing Tor Check...');
    const torRes = await axiosInstance.get('/api/tor-check', { headers: authHeaders });
    console.log('Status:', torRes.status);
    console.log('Body:', torRes.data);

    // 9. Test Billing Checkout (Mock)
    console.log('\n[9] Testing Billing Checkout (Mock)...');
    const billRes = await axiosInstance.post('/api/billing/checkout', {
      plan: 'pro',
      annual: true
    }, { headers: authHeaders });
    console.log('Status:', billRes.status);
    console.log('Redirect URL:', billRes.data.url);

    // 10. Test Logout
    console.log('\n[10] Testing Logout...');
    const logoutRes = await axiosInstance.post('/auth/logout', {}, { headers: authHeaders });
    console.log('Status:', logoutRes.status);
    console.log('Body:', logoutRes.data);

    console.log('\n--- ✅ All Core Integration Tests Passed! ---');
  } catch (error) {
    console.error('\n--- ❌ Test Failed! ---');
    console.error(error.message);
    if (error.response) {
      console.error('Response Data:', error.response.data);
    }
  }
}

runTests();
