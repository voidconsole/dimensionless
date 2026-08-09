// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// react-native-mmkv is JSI-only and cannot run in the browser. Swap it for a
// localStorage-backed shim on web so the app works there unchanged.
const defaultResolver = config.resolver?.resolveRequest;
config.resolver = {
  ...(config.resolver ?? {}),
  resolveRequest: (context, moduleName, platform) => {
    if (platform === 'web' && moduleName === 'react-native-mmkv') {
      return context.resolveRequest(
        context,
        require.resolve('./src/storage/mmkv.web.ts'),
        platform,
      );
    }
    if (typeof defaultResolver === 'function') {
      return defaultResolver(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
