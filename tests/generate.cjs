const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
let mode = 'success', calls = 0, params, options;
class APIError extends Error { constructor(status) { super('test'); this.status = status; } }
class Timeout extends Error {}
class FakeOpenAI {
  static APIError = APIError;
  static APIConnectionTimeoutError = Timeout;
  constructor(config) { options = config; }
  responses = { create: async input => {
    calls++; params = input;
    if (mode === 'quota') throw new APIError(429);
    if (mode === 'timeout') throw new Timeout();
    return { status: mode === 'incomplete' ? 'incomplete' : 'completed', output_text: mode === 'malformed' ? 'bad answer' : 'fitness|helps you track workouts' };
  } };
}
const load = Module._load;
Module._load = function(name, ...args) { return name === 'openai' ? FakeOpenAI : load.call(this, name, ...args); };
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true }
}).outputText, filename);
const { POST } = require('../app/api/generate/route.ts');
const request = value => new Request('http://localhost/api/generate', { method: 'POST', body: JSON.stringify(value) });
(async () => {
  process.env.OPENAI_API_KEY = 'test-only';
  for (const vibe of [0,1,2,3]) {
    const result = await POST(request({ vibe }));
    assert.equal(result.status, 200);
    assert.equal((await result.json()).type, 'fitness');
  }
  assert.equal(params.model, 'gpt-5.6-luna');
  assert.equal(params.reasoning.effort, 'none');
  assert.equal(params.max_output_tokens, 100);
  assert.equal(options.timeout, 20000);
  assert.equal(options.maxRetries, 0);
  const before = calls;
  for (const vibe of [-1,4,1.5,'1']) assert.equal((await POST(request({ vibe }))).status, 400);
  assert.equal((await POST(new Request('http://localhost', { method:'POST', body:'{' }))).status, 400);
  assert.equal(calls, before);
  for (const [scenario, status] of [['quota',429],['timeout',504],['malformed',502],['incomplete',502]]) {
    mode = scenario;
    assert.equal((await POST(request({ vibe:1 }))).status, status);
  }
  delete process.env.OPENAI_API_KEY;
  assert.equal((await POST(request({ vibe:1 }))).status, 503);
  console.log('PASS: four creativity levels, fixed cost controls, invalid requests, quota, timeout, malformed output, and missing key');
})().catch(error => { console.error(error); process.exitCode=1; });
