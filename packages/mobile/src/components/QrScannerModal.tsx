import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui';
import { useTheme } from '@/src/theme';

export interface QrScanResult {
  url: string;
  token: string;
}

interface QrScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (result: QrScanResult) => void;
}

function parsePairingUrl(data: string): QrScanResult | null {
  try {
    // palmsh://connect?url=http://...&token=...
    if (!data.startsWith('palmsh://connect')) {
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

export function QrScannerModal({ visible, onClose, onScan }: QrScannerModalProps) {
  const { colors, spacing, typography, radii } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const scannedRef = useRef(false);

  const handleBarCodeScanned = useCallback(
    (event: { data: string }) => {
      if (scannedRef.current) return;

      const result = parsePairingUrl(event.data);

      if (!result) {
        setError('palmsh の QR コードではありません。Gateway の起動時に表示される QR コードをスキャンしてください。');
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

  const handleShow = useCallback(() => {
    scannedRef.current = false;
    setError(null);
  }, []);

  if (!permission) {
    return null;
  }

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={handleClose} onShow={handleShow}>
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* Header */}
        <View style={[styles.header, { paddingHorizontal: spacing.lg, paddingTop: spacing['2xl'] }]}>
          <Text style={[typography.heading, { color: colors.textPrimary }]}>QR コードをスキャン</Text>
          <Pressable hitSlop={12} onPress={handleClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Ionicons color={colors.textPrimary} name="close" size={24} />
          </Pressable>
        </View>

        {!permission.granted ? (
          <View style={[styles.permissionContainer, { gap: spacing.lg, padding: spacing.xl }]}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primarySubtle }]}>
              <Ionicons color={colors.primary} name="camera-outline" size={32} />
            </View>
            <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
              QR コードを読み取るにはカメラへのアクセスが必要です。
            </Text>
            <Button label="カメラを許可" onPress={requestPermission} />
          </View>
        ) : (
          <View style={styles.cameraContainer}>
            <CameraView
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              facing="back"
              onBarcodeScanned={handleBarCodeScanned}
              style={StyleSheet.absoluteFillObject}
            />
            {/* Scan overlay */}
            <View style={styles.overlay}>
              <View style={[styles.scanFrame, { borderColor: colors.primary, borderRadius: radii.lg }]} />
              <Text style={[typography.caption, { color: '#fff', textAlign: 'center', marginTop: spacing.lg }]}>
                Gateway 起動時に表示される QR コードを枠内に合わせてください
              </Text>
            </View>

            {error ? (
              <View style={[styles.errorBanner, { backgroundColor: colors.error, padding: spacing.md }]}>
                <Text style={[typography.caption, { color: '#fff', textAlign: 'center' }]}>{error}</Text>
                <Pressable onPress={() => setError(null)}>
                  <Text style={[typography.captionMedium, { color: '#fff', textDecorationLine: 'underline' }]}>再スキャン</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}
      </View>
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
  scanFrame: {
    width: 240,
    height: 240,
    borderWidth: 3,
  },
  errorBanner: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
});
