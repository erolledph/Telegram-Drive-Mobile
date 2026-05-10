const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Explicit polyfill map for Node.js built-ins used by gramjs (telegram package).
const POLYFILLS = {
  crypto: require.resolve('crypto-browserify'),
  stream: require.resolve('stream-browserify'),
  path: require.resolve('path-browserify'),
  os: require.resolve('os-browserify/browser'),
  assert: require.resolve('assert/'),
  constants: require.resolve('constants-browserify'),
  vm: require.resolve('vm-browserify'),
  buffer: require.resolve('buffer/'),
  process: require.resolve('process/'),
  events: require.resolve('events/'),
  util: require.resolve('util/'),
};

// Modules with no browser equivalent — return an empty module stub
const EMPTY_MODULES = new Set(['fs', 'net', 'tls', 'child_process', 'dns']);

// GramJS crypto/crypto.js uses Web Crypto API (crypto.subtle.digest)
// which doesn't exist in React Native / Hermes. Redirect to our patched
// version that uses crypto-browserify (sync, pure JS).
const GRAMJS_CRYPTO_PATCH = require.resolve('./patches/gramjs-crypto.js');
const GRAMJS_CRYPTO_ORIGINAL = path.join(
  __dirname, 'node_modules', 'telegram', 'crypto', 'crypto.js'
);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // If we are on web, redirect @expo/vector-icons fonts to empty modules
  // because we are loading them via CSS manually
  if (platform === 'web' && moduleName.endsWith('.ttf') && context.originModulePath && context.originModulePath.includes('@expo/vector-icons')) {
    return { filePath: require.resolve('./emptyModule.js'), type: 'sourceFile' };
  }

  // Redirect GramJS's internal crypto to our patched version
  const defaultResolved = (() => {
    try {
      return context.resolveRequest(context, moduleName, platform);
    } catch (e) {
      return null;
    }
  })();

  // If the resolved file IS the gramjs crypto.js, swap it
  if (defaultResolved && defaultResolved.filePath) {
    const resolved = defaultResolved.filePath.replace(/\\/g, '/');
    const target = GRAMJS_CRYPTO_ORIGINAL.replace(/\\/g, '/');
    if (resolved === target) {
      return { filePath: GRAMJS_CRYPTO_PATCH, type: 'sourceFile' };
    }
  }

  // Node.js built-in polyfills
  if (POLYFILLS[moduleName]) {
    return { filePath: POLYFILLS[moduleName], type: 'sourceFile' };
  }
  if (EMPTY_MODULES.has(moduleName)) {
    return { filePath: require.resolve('./emptyModule.js'), type: 'sourceFile' };
  }

  return defaultResolved || context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
