import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/src/components/ui';
import { useTheme } from '@/src/theme';

export interface QrScanResult {
  url: string;
  token: string;
}

interface QrScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onManualEntry?: () => void;
  onScan: (result: QrScanResult) => void;
}

function parsePairingUrl(data: string): QrScanResult | null {
  try {
    // zenterm://connect?url=http://...&token=...
    if (!data.startsWith('zenterm://connect')) {
      return null;
    }

    const queryStart = data.indexOf('?');
    if (queryStart < 0) return null;

    const params = new URLSearchParams(data.slice(queryStart + 1));
    const url = params.get('url');
    const token = params.get('token');

    if (!url || !token) return null;

    return { url, token };
  } catch {
    return null;
  }
}

function QrScannerContent({ visible, onClose, onManualEntry, onScan }: QrScannerModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, spacing, typography, radii } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const scannedRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    scannedRef.current = false;
    setError(null);
  }, [visible]);

  const handleBarCodeScanned = useCallback(
    (event: { data: string }) => {
      if (scannedRef.current) return;

      const result = parsePairingUrl(event.data);

      if (!result) {
        setError('Not a ZenTerm QR code. Please scan the QR code shown when the gateway starts.');
        return;
      }

      scannedRef.current = true;
      onScan(result);
      onClose();
    },
    [onScan, onClose],
  );

  const handleClose = useCallback(() => {
    scannedRef.current = false;
    setError(null);
    onClose();
  }, [onClose]);

  const handleManualEntry = useCallback(() => {
    scannedRef.current = false;
    setError(null);
    onClose();
    onManualEntry?.();
  }, [onClose, onManualEntry]);

  const handlePermissionRequest = useCallback(() => {
    void requestPermission();
  }, [requestPermission]);

  const handleOpenSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  const permissionLocked = permission && !permission.granted && permission.canAskAgain === false;

  const permissionTitle = useMemo(
    () => (permissionLocked ? 'Camera Access Is Off' : 'Camera Access Required'),
    [permissionLocked],
  );

  const permissionDescription = useMemo(
    () =>
      permissionLocked
        ? 'Enable camera access in Settings to scan the QR code, or continue with manual entry.'
        : 'Camera access is required to scan the QR code shown by the gateway.',
    [permissionLocked],
  );

  const errorMessage =
    error ?? 'Align the QR code from the gateway inside the frame. You can switch to manual entry at any time.';

  if (!permission) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { paddingHorizontal: spacing.lg }]}>
        <Text style={[typography.heading, { color: colors.textPrimary }]}>Scan QR Code</Text>
        <Pressable hitSlop={12} onPress={handleClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <Ionicons color={colors.textPrimary} name="close" size={24} />
        </Pressable>
      </View>

      {!permission.granted ? (
        <View style={[styles.permissionContainer, { gap: spacing.lg, padding: spacing.xl }]}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primarySubtle }]}>
            <Ionicons color={colors.primary} name="camera-outline" size={32} />
          </View>
          <Text style={[typography.heading, { color: colors.textPrimary, textAlign: 'center' }]}>
            {permissionTitle}
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
            {permissionDescription}
          </Text>
          <View style={[styles.permissionActions, { gap: spacing.sm }]}>
            <Button
              label={permissionLocked ? 'Open Settings' : 'Allow Camera'}
              onPress={permissionLocked ? handleOpenSettings : handlePermissionRequest}
            />
            <Button label="Enter Manually" onPress={handleManualEntry} variant="secondary" />
          </View>
        </View>
      ) : (
        <View style={styles.cameraContainer}>
          <CameraView
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            facing="back"
            onBarcodeScanned={handleBarCodeScanned}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.overlay}>
            <View style={[styles.scanFrame, { borderColor: colors.primary, borderRadius: radii.lg }]} />
          </View>
          <View style={[styles.bottomPanel, { padding: spacing.lg }]}>
            <View
              style={[
                styles.messageCard,
                {
                  backgroundColor: error ? colors.errorSubtle : colors.surface,
                  borderColor: error ? colors.error : colors.border,
                  padding: spacing.md,
                },
              ]}
            >
              <Text style={[typography.captionMedium, { color: error ? colors.error : colors.textPrimary, textAlign: 'center' }]}>
                {error ? 'Scan Failed' : 'Need Help?'}
              </Text>
              <Text style={[typography.caption, { color: error ? colors.error : colors.textSecondary, textAlign: 'center' }]}>
                {errorMessage}
              </Text>
              <View style={[styles.inlineActions, { marginTop: spacing.sm }]}>
                {error ? (
                  <Pressable onPress={() => setError(null)} style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}>
                    <Text style={[typography.captionMedium, { color: colors.primary }]}>Scan Again</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={handleManualEntry} style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}>
                  <Text style={[typography.captionMedium, { color: colors.primary }]}>Enter Manually</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

export function QrScannerModal({ visible, onClose, onManualEntry, onScan }: QrScannerModalProps) {
  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <SafeAreaProvider>
        <QrScannerContent visible={visible} onClose={onClose} onManualEntry={onManualEntry} onScan={onScan} />
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionActions: {
    width: '100%',
    maxWidth: 320,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraContainer: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  scanFrame: {
    width: 240,
    height: 240,
    borderWidth: 3,
  },
  messageCard: {
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
  },
  inlineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
});
