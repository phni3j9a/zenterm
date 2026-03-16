import { Ionicons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, {
  SwipeDirection,
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { Extrapolation, interpolate, type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { useTheme } from '@/src/theme';

interface SwipeAction {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  label: string;
  onPress: () => void;
  hapticStyle?: Haptics.ImpactFeedbackStyle | null;
}

interface SwipeableRowProps {
  children: React.ReactNode;
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
}

interface ActionPaneProps {
  action: SwipeAction;
  progress: SharedValue<number>;
  translation: SharedValue<number>;
  side: 'left' | 'right';
  onPress: () => void;
}

function ActionPane({ action, progress, translation, side, onPress }: ActionPaneProps) {
  const { colors, radii } = useTheme();

  const animatedStyle = useAnimatedStyle(() => {
    const distance = Math.abs(translation.value);
    return {
      opacity: interpolate(distance, [0, 24, 80], [0.2, 0.55, 1], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(progress.value, [0, 1], [0.92, 1], Extrapolation.CLAMP) }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.actionArea,
        side === 'left' ? styles.leftActionArea : styles.rightActionArea,
        animatedStyle,
      ]}
    >
      <Pressable
        accessibilityLabel={action.label}
        accessibilityRole="button"
        onPress={onPress}
        style={[styles.actionButton, { backgroundColor: action.color, borderRadius: radii.md }]}
      >
        <Ionicons color={colors.textInverse} name={action.icon} size={24} />
      </Pressable>
    </Animated.View>
  );
}

export function SwipeableRow({ children, leftAction, rightAction }: SwipeableRowProps) {
  const swipeableRef = useRef<SwipeableMethods | null>(null);

  if (!leftAction && !rightAction) {
    return <View testID="swipeable-row-root">{children}</View>;
  }

  const handleActionPress = (action: SwipeAction) => {
    swipeableRef.current?.close();
    action.onPress();
  };

  const handleSwipeOpen = (direction: SwipeDirection.LEFT | SwipeDirection.RIGHT) => {
    const action = direction === SwipeDirection.RIGHT ? leftAction : rightAction;
    if (action) {
      const hapticStyle = action.hapticStyle === undefined ? Haptics.ImpactFeedbackStyle.Medium : action.hapticStyle;
      if (hapticStyle !== null) {
        void Haptics.impactAsync(hapticStyle);
      }
    }
  };

  return (
    <ReanimatedSwipeable
      animationOptions={{ damping: 18, stiffness: 180 }}
      containerStyle={styles.container}
      friction={1.5}
      leftThreshold={80}
      onSwipeableWillOpen={handleSwipeOpen}
      overshootFriction={8}
      ref={swipeableRef}
      renderLeftActions={
        leftAction
          ? (progress, translation) => (
              <ActionPane
                action={leftAction}
                onPress={() => handleActionPress(leftAction)}
                progress={progress}
                side="left"
                translation={translation}
              />
            )
          : undefined
      }
      renderRightActions={
        rightAction
          ? (progress, translation) => (
              <ActionPane
                action={rightAction}
                onPress={() => handleActionPress(rightAction)}
                progress={progress}
                side="right"
                translation={translation}
              />
            )
          : undefined
      }
      rightThreshold={80}
      testID="swipeable-row-root"
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  actionArea: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 96,
  },
  leftActionArea: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  rightActionArea: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 88,
    height: '100%',
  },
});
