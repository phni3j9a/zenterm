import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/src/theme';

interface InputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'url' | 'email-address' | 'numeric';
  autoCorrect?: boolean;
}

export function Input({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  secureTextEntry = false,
  autoCapitalize = 'sentences',
  keyboardType = 'default',
  autoCorrect = true,
}: InputProps) {
  const { colors, dark, radii, typography } = useTheme();
  const [focused, setFocused] = useState(false);

  const inputStyle = {
    height: 48,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    borderWidth: 1,
    color: colors.textPrimary,
    backgroundColor: dark ? colors.surfaceHover : colors.bg,
    borderColor: error ? colors.error : focused ? colors.primary : colors.border,
    ...(focused
      ? {
          shadowColor: colors.focus,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: dark ? 0.3 : 0.18,
          shadowRadius: 8,
          elevation: Platform.OS === 'android' ? 2 : 0,
        }
      : {}),
  } as const;

  return (
    <View testID="input-root">
      {label ? (
        <Text style={[typography.captionMedium, styles.label, { color: colors.textSecondary }]}>{label}</Text>
      ) : null}

      <TextInput
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        keyboardType={keyboardType}
        onBlur={() => setFocused(false)}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        style={inputStyle}
        testID="input-field"
        value={value}
      />

      {error ? (
        <Text style={[typography.small, styles.error, { color: colors.error }]} testID="input-error">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: 6,
  },
  error: {
    marginTop: 4,
  },
});
