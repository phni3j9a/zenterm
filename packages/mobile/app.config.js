const IS_DEV = process.env.APP_VARIANT === 'development';

export default {
  expo: {
    name: IS_DEV ? 'ZenTerm (Dev)' : 'ZenTerm',
    slug: 'ZenTerm',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: IS_DEV ? 'zenterm-dev' : 'zenterm',
    userInterfaceStyle: 'dark',
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#FBF8F1',
    },
    ios: {
      bundleIdentifier: IS_DEV ? 'com.zenterm.mobile.dev' : 'com.zenterm.mobile',
      supportsTablet: true,
      infoPlist: {
        NSCameraUsageDescription:
          'QRコードをスキャンしてサーバーに接続するためにカメラを使用します',
        NSPhotoLibraryUsageDescription:
          'ターミナルセッションに画像をアップロードするために写真ライブラリにアクセスします',
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
        },
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#FBF8F1',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-font',
      'expo-web-browser',
      'expo-camera',
      [
        'expo-image-picker',
        {
          photosPermission: 'Upload images to terminal sessions',
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: 'ffaf2401-dd1e-4e87-9e5c-805a48e3491c',
      },
    },
    owner: 'asitaka.k',
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: 'https://u.expo.dev/ffaf2401-dd1e-4e87-9e5c-805a48e3491c',
    },
  },
};
