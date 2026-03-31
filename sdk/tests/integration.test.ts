import { MirrorAIClient } from '../src/saas-client';

// 用真实 API 测试（假设 SaaS 在 localhost:3001 运行）
async function testIntegration() {
  const client = new MirrorAIClient({
    apiKey: 'mk_test_demo_key',
    baseUrl: 'http://localhost:3001',
  });

  console.log('🧪 Testing MirrorAIClient integration...');

  // Test 1: syncRecords
  try {
    const result = await client.syncRecords('test-agent', [{
      type: 'decision',
      input: { message: 'test' },
      output: { response: 'ok' },
      timestamp: new Date().toISOString(),
    }]);
    console.log(`  syncRecords: ${result.success ? '✅' : '❌'} ${result.recordsSynced || result.error}`);
  } catch (e) {
    console.log(`  syncRecords: ❌ ${(e as Error).message}`);
  }

  // Test 2: submitEvaluation
  try {
    const result = await client.submitEvaluation('test-agent', {
      totalScore: 85,
      grade: 'A',
      dimensions: {
        security: { score: 90, max: 100 },
        reliability: { score: 80, max: 100 },
        observability: { score: 85, max: 100 },
        compliance: { score: 88, max: 100 },
        explainability: { score: 82, max: 100 },
      },
    });
    console.log(`  submitEvaluation: ${result.success ? '✅' : '❌'} ${result.evalId || result.error}`);
  } catch (e) {
    console.log(`  submitEvaluation: ❌ ${(e as Error).message}`);
  }

  // Test 3: submitReport
  try {
    const result = await client.submitReport('test-agent', {
      summary: {
        totalDecisions: 100,
        totalToolCalls: 50,
        totalErrors: 2,
        avgDuration: 150,
        uniqueTools: 5,
      },
      records: [],
      anomalies: [],
      generatedAt: new Date().toISOString(),
    });
    console.log(`  submitReport: ${result.success ? '✅' : '❌'} ${result.reportId || result.error}`);
  } catch (e) {
    console.log(`  submitReport: ❌ ${(e as Error).message}`);
  }

  // Test 4: verifyCertificate
  try {
    const result = await client.verifyCertificate('cert-001');
    console.log(`  verifyCertificate: ${result.valid ? '✅' : '❌'} ${result.agentName}`);
  } catch (e) {
    console.log(`  verifyCertificate: ❌ ${(e as Error).message}`);
  }
}

testIntegration().catch(console.error);
