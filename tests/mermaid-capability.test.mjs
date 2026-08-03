import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MERMAID_CAPABILITY_REQUIREMENTS,
  detectMermaidCapability
} from '../mermaid-capability.mjs';

const descriptor = {
  ...MERMAID_CAPABILITY_REQUIREMENTS
};
const dependency = {
  ...descriptor,
  entry: 'mermaid.esm.min.mjs',
  chunkDirectory: 'chunks/mermaid.esm.min',
  chunks: 103
};

function response(json, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return json;
    }
  };
}

function sequenceFetch(...responses) {
  let index = 0;
  return async () => responses[index++];
}

test('能力标记关闭时不读取 Mermaid 依赖', async () => {
  let calls = 0;
  const result = await detectMermaidCapability(async () => {
    calls += 1;
    return response({ ...descriptor, available: false });
  });

  assert.equal(result.available, false);
  assert.equal(result.reason, 'missing');
  assert.equal(calls, 1);
});

test('能力标记与依赖清单匹配时启用 Mermaid', async () => {
  const result = await detectMermaidCapability(sequenceFetch(
    response({ ...descriptor, available: true }),
    response(dependency)
  ));

  assert.deepEqual(result, {
    available: true,
    reason: 'available',
    version: '11.16.0',
    chunks: 103
  });
});

test('依赖版本不匹配时回退源码', async () => {
  const result = await detectMermaidCapability(sequenceFetch(
    response({ ...descriptor, available: true }),
    response({ ...dependency, version: '10.0.0' })
  ));

  assert.equal(result.available, false);
  assert.equal(result.reason, 'incompatible');
});

test('依赖清单损坏时回退源码', async () => {
  const result = await detectMermaidCapability(sequenceFetch(
    response({ ...descriptor, available: true }),
    response({ ...dependency, chunks: 2 })
  ));

  assert.equal(result.available, false);
  assert.equal(result.reason, 'broken');
});
