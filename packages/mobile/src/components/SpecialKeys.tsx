import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { uploadFile } from '@/src/api/client';
import { useTheme } from '@/src/theme';
import { terminalColorsLight, terminalColorsDark } from '@/src/theme/tokens';
import type { Server } from '@/src/types';

interface Props {
  onKeyPress: (data: string, options?: { noFocus?: boolean }) => void;
  server?: Server;
}

const ARROW_KEYS = [
  { label: '\u2190', data: '\x1b[D' },
  { label: '\u2191', data: '\x1b[A' },
  { label: '\u2193', data: '\x1b[B' },
  { label: '\u2192', data: '\x1b[C' },
] as const;

const CTRL_KEYS = [
  { label: 'C', code: '\x03' },
  { label: 'D', code: '\x04' },
  { label: 'Z', code: '\x1a' },
  { label: 'L', code: '\x0c' },
  { label: 'A', code: '\x01' },
  { label: 'E', code: '\x05' },
  { label: 'W', code: '\x17' },
  { label: 'R', code: '\x12' },
] as const;

export function SpecialKeys({ onKeyPress, server }: Props) {
  const [isCtrl, setIsCtrl] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { dark, colors, radii, spacing, typography } = useTheme();
  const termBg = dark ? terminalColorsDark.bg : terminalColorsLight.bg;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          backgroundColor: termBg,
        },
        row: {
          flexDirection: 'row',
          gap: spacing.sm,
          paddingRight: spacing.sm,
        },
        ctrlRow: {
          gap: spacing.xs,
        },
        ctrlHint: {
          ...typography.smallMedium,
          color: colors.primary,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        },
        button: {
          minWidth: 44,
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.md,
          borderRadius: radii.sm,
          backgroundColor: colors.surfaceHover,
        },
        buttonActive: {
          backgroundColor: colors.primary,
        },
        ctrlKeyButton: {
          minWidth: 46,
          backgroundColor: colors.primarySubtle,
        },
        pasteButton: {
          minWidth: 70,
          height: 36,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          paddingHorizontal: spacing.md,
          borderRadius: radii.sm,
          backgroundColor: colors.surfaceHover,
        },
        label: {
          ...typography.captionMedium,
          color: colors.textPrimary,
        },
        labelActive: {
          color: colors.textInverse,
        },
        labelCtrl: {
          color: colors.primary,
        },
      }),
    [colors, radii, spacing, termBg, typography],
  );

  const triggerHaptic = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleBaseKeyPress = (data: string) => {
    triggerHaptic();
    onKeyPress(data, { noFocus: true });
  };

  const handleCtrlToggle = () => {
    triggerHaptic();
    setIsCtrl((current) => !current);
  };

  const handleCtrlKeyPress = (data: string) => {
    triggerHaptic();
    onKeyPress(data, { noFocus: true });
    setIsCtrl(false);
  };

  const handlePaste = async () => {
    triggerHaptic();
    const text = await Clipboard.getStringAsync();
    if (!text) {
      return;
    }

    onKeyPress(text);
  };

  const handleImageUpload = async () => {
    if (!server) return;
    triggerHaptic();
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      setUploading(true);
      const fileName = asset.fileName ?? `image_${Date.now()}.jpg`;
      const mimeType = asset.mimeType ?? 'image/jpeg';
      const response = await uploadFile(server, asset.uri, fileName, mimeType);
      onKeyPress(response.path + ' ');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed.';
      Toast.show({ type: 'error', text1: 'Upload Failed', text2: message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal contentContainerStyle={styles.row} showsHorizontalScrollIndicator={false}>
        <TouchableOpacity activeOpacity={0.78} onPress={() => handleBaseKeyPress('\x1b')} style={styles.button}>
          <Text style={styles.label}>Esc</Text>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.78} onPress={() => handleBaseKeyPress('\t')} style={styles.button}>
          <Text style={styles.label}>Tab</Text>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.78} onPress={() => handleBaseKeyPress('\x1b[Z')} style={styles.button}>
          <Text style={styles.label}>S-Tab</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.78}
          onPress={handleCtrlToggle}
          style={[styles.button, isCtrl && styles.buttonActive]}
        >
          <Text style={[styles.label, isCtrl && styles.labelActive]}>Ctrl</Text>
        </TouchableOpacity>

        {ARROW_KEYS.map((key) => (
          <TouchableOpacity
            key={key.label}
            activeOpacity={0.78}
            onPress={() => handleBaseKeyPress(key.data)}
            style={styles.button}
          >
            <Text style={styles.label}>{key.label}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity activeOpacity={0.78} onPress={() => handleBaseKeyPress('\r')} style={styles.button}>
          <Ionicons color={colors.textPrimary} name="return-down-back-outline" size={16} />
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.78} onPress={() => void handlePaste()} style={styles.pasteButton}>
          <Ionicons color={colors.textPrimary} name="clipboard-outline" size={16} />
          <Text style={styles.label}>Paste</Text>
        </TouchableOpacity>

        {server && (
          <TouchableOpacity
            activeOpacity={0.78}
            disabled={uploading}
            onPress={() => void handleImageUpload()}
            style={styles.pasteButton}
          >
            {uploading ? (
              <ActivityIndicator color={colors.textPrimary} size={16} />
            ) : (
              <Ionicons color={colors.textPrimary} name="image-outline" size={16} />
            )}
            <Text style={styles.label}>{uploading ? '...' : 'Image'}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {isCtrl ? (
        <View style={styles.ctrlRow}>
          <Text style={styles.ctrlHint}>Ctrl mode</Text>
          <ScrollView horizontal contentContainerStyle={styles.row} showsHorizontalScrollIndicator={false}>
            {CTRL_KEYS.map((key) => (
              <TouchableOpacity
                key={key.label}
                activeOpacity={0.78}
                onPress={() => handleCtrlKeyPress(key.code)}
                style={[styles.button, styles.ctrlKeyButton]}
              >
                <Text style={[styles.label, styles.labelCtrl]}>{key.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
