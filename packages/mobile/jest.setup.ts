/// <reference types="jest" />

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
}));

jest.mock('expo-secure-store', () => ({
  __esModule: true,
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock('expo-haptics', () => ({
  __esModule: true,
  ImpactFeedbackStyle: {
    Light: 'Light',
    Medium: 'Medium',
  },
  impactAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    Ionicons: ({ name, color, size }: { name: string; color?: string; size?: number }) =>
      React.createElement(Text, { testID: 'mock-ionicon', color, size }, name),
  };
});

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const React = require('react');
  const { View } = require('react-native');

  const Swipeable = React.forwardRef(({ children, ...props }: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      close: () => undefined,
      openLeft: () => undefined,
      openRight: () => undefined,
      reset: () => undefined,
    }));

    return React.createElement(View, { ...props, testID: 'mock-swipeable' }, children);
  });

  return {
    __esModule: true,
    SwipeDirection: {
      LEFT: 'left',
      RIGHT: 'right',
    },
    default: Swipeable,
  };
});

jest.mock('react-native-toast-message', () => {
  const React = require('react');
  const { View } = require('react-native');

  const Toast = ({ children, ...props }: any) => React.createElement(View, { ...props, testID: 'mock-toast' }, children);
  Toast.show = jest.fn();
  Toast.hide = jest.fn();

  return {
    __esModule: true,
    BaseToast: (props: any) => React.createElement(View, { ...props, testID: 'mock-base-toast' }),
    default: Toast,
  };
});

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');

  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 12, left: 0 }),
  };
});
