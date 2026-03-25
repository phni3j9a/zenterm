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

type ExpandedPanel = 'ctrl' | 'more' | null;

export function SpecialKeys({ onKeyPress, server }: Props) {
  const [expandedPanel, setExpandedPanel] = useState<ExpandedPanel>(null);
  const [uploading, setUploading] = useState(false);
  const { dark, colors, radii, spacing, typography } = useTheme();
  const termBg = dark ? terminalColorsDark.bg : terminalColorsLight.bg;

  const isCtrl = expandedPanel === 'ctrl';
  const isMore = expandedPanel === 'more';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          gap: spacing.sm,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.sm,
          maxWidth: 480,
          alignSelf: 'center',
          width: '100%',
          backgroundColor: termBg,
        },
        row: {
          flexDirection: 'row',
          gap: spacing.xs,
        },
        expandedRow: {
          gap: spacing.xs,
        },
        expandedHint: {
          ...typography.smallMedium,
          color: colors.primary,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        },
        expandedScrollContent: {
          flexDirection: 'row',
          gap: spacing.sm,
          paddingRight: spacing.sm,
        },
        buttonText: {
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.sm,
          borderRadius: radii.sm,
          backgroundColor: colors.surfaceHover,
        },
        buttonSymbol: {
          flex: 1,
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
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
        moreItemButton: {
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

  const togglePanel = (panel: 'ctrl' | 'more') => {
    triggerHaptic();
    setExpandedPanel((current) => (current === panel ? null : panel));
  };

  const handleCtrlKeyPress = (data: string) => {
    triggerHaptic();
    onKeyPress(data, { noFocus: true });
    setExpandedPanel(null);
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
      <View style={styles.row}>
        <TouchableOpacity activeOpacity={0.78} onPress={() => handleBaseKeyPress('\x1b')} style={styles.buttonText}>
          <Text style={styles.label}>Esc</Text>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.78} onPress={() => handleBaseKeyPress('\t')} style={styles.buttonText}>
          <Text style={styles.label}>Tab</Text>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.78} onPress={() => handleBaseKeyPress('\x1b[Z')} style={styles.buttonText}>
          <Text style={styles.label}>{'\u21e7Tab'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.78}
          onPress={() => togglePanel('ctrl')}
          style={[styles.buttonText, isCtrl && styles.buttonActive]}
        >
          <Text style={[styles.label, isCtrl && styles.labelActive]}>Ctrl</Text>
        </TouchableOpacity>

        {ARROW_KEYS.map((key) => (
          <TouchableOpacity
            key={key.label}
            activeOpacity={0.78}
            onPress={() => handleBaseKeyPress(key.data)}
            style={styles.buttonSymbol}
          >
            <Text style={styles.label}>{key.label}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity activeOpacity={0.78} onPress={() => handleBaseKeyPress('\r')} style={styles.buttonSymbol}>
          <Ionicons color={colors.textPrimary} name="return-down-back-outline" size={16} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.78}
          onPress={() => togglePanel('more')}
          style={[styles.buttonSymbol, isMore && styles.buttonActive]}
        >
          <Ionicons color={isMore ? colors.textInverse : colors.textPrimary} name="ellipsis-horizontal" size={16} />
        </TouchableOpacity>
      </View>

      {isCtrl ? (
        <View style={styles.expandedRow}>
          <Text style={styles.expandedHint}>Ctrl mode</Text>
          <ScrollView horizontal contentContainerStyle={styles.expandedScrollContent} showsHorizontalScrollIndicator={false}>
            {CTRL_KEYS.map((key) => (
              <TouchableOpacity
                key={key.label}
                activeOpacity={0.78}
                onPress={() => handleCtrlKeyPress(key.code)}
                style={[styles.buttonText, styles.ctrlKeyButton]}
              >
                <Text style={[styles.label, styles.labelCtrl]}>{key.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {isMore ? (
        <View style={[styles.expandedRow, styles.row]}>
          <TouchableOpacity activeOpacity={0.78} onPress={() => void handlePaste()} style={styles.moreItemButton}>
            <Ionicons color={colors.textPrimary} name="clipboard-outline" size={16} />
            <Text style={styles.label}>Paste</Text>
          </TouchableOpacity>

          {server && (
            <TouchableOpacity
              activeOpacity={0.78}
              disabled={uploading}
              onPress={() => void handleImageUpload()}
              style={styles.moreItemButton}
            >
              {uploading ? (
                <ActivityIndicator color={colors.textPrimary} size={16} />
              ) : (
                <Ionicons color={colors.textPrimary} name="image-outline" size={16} />
              )}
              <Text style={styles.label}>{uploading ? '...' : 'Image'}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </View>
  );
}
