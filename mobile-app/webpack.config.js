const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const webpack = require('webpack');
const path = require('path');
const fs = require('fs');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Use index.web.js as the entry point if it exists
  const indexWebPath = path.resolve(__dirname, 'index.web.js');
  const indexPath = path.resolve(__dirname, 'index.js');
  const entryPath = fs.existsSync(indexWebPath) ? indexWebPath : indexPath;

  if (config.entry) {
    if (Array.isArray(config.entry)) {
      config.entry[0] = entryPath;
    } else if (typeof config.entry === 'object') {
      const firstKey = Object.keys(config.entry)[0];
      if (Array.isArray(config.entry[firstKey])) {
        config.entry[firstKey][0] = entryPath;
      }
    }
  }

  // Polyfills for Telegram's gramjs Node.js dependencies
  config.resolve.fallback = {
    ...config.resolve.fallback,
    fs: false,
    net: false,
    tls: false,
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    path: require.resolve('path-browserify'),
    util: require.resolve('util/'),
    os: require.resolve('os-browserify/browser'),
    assert: require.resolve('assert/'),
    constants: require.resolve('constants-browserify'),
    vm: require.resolve('vm-browserify'),
  };

  config.plugins.push(
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    })
  );

  config.ignoreWarnings = [
    /Failed to parse source map/,
    /smart-buffer/,
    /socks/,
  ];

  config.module.rules.forEach(rule => {
    if (rule.oneOf) {
      // Find the rule handling font files and override the public path.
      // expo-webpack-config's file-loader for fonts usually targets node_modules output.
      rule.oneOf.forEach(oneOfRule => {
        if (oneOfRule.use && oneOfRule.use.loader && oneOfRule.use.loader.includes('file-loader') && oneOfRule.test && oneOfRule.test.toString().includes('ttf')) {
           oneOfRule.use.options.publicPath = '';
        }
      });
    }
  });

  // Specifically intercept @expo/vector-icons fonts to point to our custom directory
  config.plugins.push(
    new webpack.NormalModuleReplacementPlugin(
      /@expo\/vector-icons\/.*\.ttf/,
      (resource) => {
        // Point to empty module to avoid webpack loading the .ttf file
        resource.request = path.resolve(__dirname, 'emptyModule.js');
      }
    )
  );

  return config;
};
