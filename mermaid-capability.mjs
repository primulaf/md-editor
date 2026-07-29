const EXPECTED_NAME = 'mermaid';
const EXPECTED_VERSION = '11.16.0';
const EXPECTED_RENDERER_API = 1;
const CAPABILITY_URL = new URL('./mermaid-capability.json', import.meta.url);
const DEPENDENCY_MANIFEST_URL = new URL('./lib/mermaid/version.json', import.meta.url);

let capabilityPromise = null;

function unavailable(reason, detail = '') {
  return {
    available: false,
    reason,
    detail
  };
}

function validateDescriptor(descriptor, kind) {
  if (!descriptor || typeof descriptor !== 'object') {
    return unavailable('broken', `${kind}不是有效的 JSON 对象`);
  }
  if (descriptor.name !== EXPECTED_NAME) {
    return unavailable('incompatible', `${kind}组件名称不匹配`);
  }
  if (descriptor.version !== EXPECTED_VERSION) {
    return unavailable(
      'incompatible',
      `${kind}版本为 ${descriptor.version || '未知'}，需要 ${EXPECTED_VERSION}`
    );
  }
  if (descriptor.rendererApi !== EXPECTED_RENDERER_API) {
    return unavailable(
      'incompatible',
      `${kind}接口版本为 ${descriptor.rendererApi ?? '未知'}，需要 ${EXPECTED_RENDERER_API}`
    );
  }
  return null;
}

async function readJson(fetchImpl, url, label) {
  const response = await fetchImpl(url, { cache: 'no-store' });
  if (!response?.ok) {
    throw new Error(`${label}读取失败（${response?.status || '无状态码'}）`);
  }
  return response.json();
}

export async function detectMermaidCapability(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') {
    return unavailable('broken', '当前环境不支持读取组件信息');
  }

  let marker;
  try {
    marker = await readJson(fetchImpl, CAPABILITY_URL, 'Mermaid 能力标记');
  } catch (error) {
    return unavailable('broken', String(error?.message || error));
  }

  if (marker?.available === false) {
    return unavailable('missing');
  }
  if (marker?.available !== true) {
    return unavailable('broken', 'Mermaid 能力标记缺少 available 字段');
  }

  const markerError = validateDescriptor(marker, '能力标记');
  if (markerError) return markerError;

  let dependency;
  try {
    dependency = await readJson(fetchImpl, DEPENDENCY_MANIFEST_URL, 'Mermaid 依赖清单');
  } catch (error) {
    return unavailable('broken', String(error?.message || error));
  }

  const dependencyError = validateDescriptor(dependency, '依赖清单');
  if (dependencyError) return dependencyError;
  if (
    dependency.entry !== 'mermaid.esm.min.mjs'
    || dependency.chunkDirectory !== 'chunks/mermaid.esm.min'
    || !Number.isInteger(dependency.chunks)
    || dependency.chunks < 100
  ) {
    return unavailable('broken', 'Mermaid 依赖清单中的入口或分块信息不完整');
  }

  return {
    available: true,
    reason: 'available',
    version: dependency.version,
    chunks: dependency.chunks
  };
}

export function getMermaidCapability() {
  if (!capabilityPromise) {
    capabilityPromise = detectMermaidCapability();
  }
  return capabilityPromise;
}

export function resetMermaidCapabilityCache() {
  capabilityPromise = null;
}

export const MERMAID_CAPABILITY_REQUIREMENTS = Object.freeze({
  name: EXPECTED_NAME,
  version: EXPECTED_VERSION,
  rendererApi: EXPECTED_RENDERER_API
});
