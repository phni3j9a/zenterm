import React, { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/src/theme';

interface SkeletonProps {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export function SkeletonLoader({ width, height, radius, style }: SkeletonProps) {
  const { colors, radii } = useTheme();
  const progress = useSharedValue(0);
  const [measuredWidth, setMeasuredWidth] = useState(typeof width === 'number' ? width : 0);

  useEffect(() => {
    if (typeof width === 'number') {
      setMeasuredWidth(width);
    }
  }, [width]);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, {
        duration: 1200,
        easing: Easing.linear,
      }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(progress);
    };
  }, [progress]);

  const shimmerWidth = measuredWidth > 0 ? Math.max(measuredWidth * 0.42, 48) : 72;

  const shimmerStyle = useAnimatedStyle(() => {
    const containerWidth = measuredWidth || 200;
    return {
      backgroundColor: interpolateColor(
        progress.value,
        [0, 0.5, 1],
        [colors.skeleton, colors.skeletonHighlight, colors.skeleton],
      ),
      transform: [
        {
          translateX: interpolate(progress.value, [0, 1], [-shimmerWidth, containerWidth + shimmerWidth]),
        },
      ],
    };
  });

  const handleLayout = (event: LayoutChangeEvent) => {
    if (typeof width === 'string') {
      setMeasuredWidth(event.nativeEvent.layout.width);
    }
  };

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.container,
        {
          width,
          height,
          borderRadius: radius ?? radii.md,
          backgroundColor: colors.skeleton,
        },
        style,
      ]}
      testID="skeleton-root"
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shimmer,
          {
            width: shimmerWidth,
            borderRadius: radius ?? radii.md,
          },
          shimmerStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
  },
});
