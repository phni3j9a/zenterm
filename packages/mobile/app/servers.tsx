import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { verifyAuth } from '@/src/api/client';
import { QrScannerModal, type QrScanResult } from '@/src/components/QrScannerModal';
import { Badge, Button, Card, EmptyState, Input, SwipeableRow } from '@/src/components/ui';
import { useServersStore } from '@/src/stores/servers';
import { useTheme } from '@/src/theme';
import type { Server } from '@/src/types';

const initialForm = {
  name: '',
  url: '',
  token: '',
};

type ServerForm = typeof initialForm;
type FormErrors = Partial<Record<keyof ServerForm, string>>;

const urlPattern = /^https?:\/\//i;

function createServerPayload(form: ServerForm): Server {
  return {
    id: 'verify',
    name: form.name.trim(),
    url: form.url.trim(),
    token: form.token.trim(),
    isDefault: false,
  };
}

function validateForm(form: ServerForm): FormErrors {
  const errors: FormErrors = {};

  if (!form.name.trim()) {
    errors.name = 'Please enter a server name.';
  }

  if (!form.url.trim()) {
    errors.url = 'Please enter a URL.';
  } else if (!urlPattern.test(form.url.trim())) {
    errors.url = 'Must start with http:// or https://.';
  }

  if (!form.token.trim()) {
    errors.token = 'Please enter a token.';
  }

  return errors;
}

function hasErrors(errors: FormErrors) {
  return Object.values(errors).some(Boolean);
}

interface ServerFormCardProps {
  accent: string;
  description: string;
  errors: FormErrors;
  form: ServerForm;
  saving: boolean;
  style?: StyleProp<ViewStyle>;
  submitLabel: string;
  testing: boolean;
  title: string;
  onCancel: () => void;
  onChange: (field: keyof ServerForm, value: string) => void;
  onSubmit: () => void;
  onTest: () => void;
}

function ServerFormCard({
  accent,
  description,
  errors,
  form,
  saving,
  style,
  submitLabel,
  testing,
  title,
  onCancel,
  onChange,
  onSubmit,
  onTest,
}: ServerFormCardProps) {
  const { colors, spacing, typography } = useTheme();

  return (
    <Card style={[{ gap: spacing.lg }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text style={[typography.heading, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{description}</Text>
        </View>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: accent,
          }}
        >
          <Ionicons color={colors.textInverse} name="construct-outline" size={20} />
        </View>
      </View>

      <Input label="Name" value={form.name} error={errors.name} placeholder="Raspberry Pi 5" onChangeText={(value) => onChange('name', value)} />
      <Input
        autoCapitalize="none"
        error={errors.url}
        keyboardType="url"
        label="URL"
        placeholder="https://example.local:3000"
        value={form.url}
        onChangeText={(value) => onChange('url', value)}
      />
      <Input
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.token}
        label="Token"
        placeholder="AUTH_TOKEN"
        secureTextEntry
        value={form.token}
        onChangeText={(value) => onChange('token', value)}
      />

      <View style={{ gap: spacing.sm }}>
        <Button
          disabled={saving}
          icon={<Ionicons color={colors.textPrimary} name="shield-checkmark-outline" size={16} />}
          label={testing ? 'Testing...' : 'Auth Test'}
          loading={testing}
          variant="secondary"
          onPress={onTest}
        />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button disabled={saving || testing} label="Cancel" variant="ghost" onPress={onCancel} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              disabled={testing}
              icon={<Ionicons color={colors.textInverse} name="save-outline" size={16} />}
              label={submitLabel}
              loading={saving}
              onPress={onSubmit}
            />
          </View>
        </View>
      </View>
    </Card>
  );
}

export default function ServersScreen() {
  const router = useRouter();
  const { colors, dark, radii, spacing, typography } = useTheme();
  const servers = useServersStore((state) => state.servers);
  const addServer = useServersStore((state) => state.addServer);
  const updateServer = useServersStore((state) => state.updateServer);
  const removeServer = useServersStore((state) => state.removeServer);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(initialForm);
  const [editErrors, setEditErrors] = useState<FormErrors>({});
  const [testingTarget, setTestingTarget] = useState<'add' | 'edit' | null>(null);
  const [savingTarget, setSavingTarget] = useState<'add' | 'edit' | null>(null);
  const [showQrScanner, setShowQrScanner] = useState(false);

  const handleQrScan = useCallback(
    (result: QrScanResult) => {
      // QRスキャン結果でフォームを自動入力
      setEditingServerId(null);
      setEditForm(initialForm);
      setEditErrors({});
      setShowForm(true);
      setForm({
        name: new URL(result.url).hostname,
        url: result.url,
        token: result.token,
      });
      setFormErrors({});

      // 自動認証テスト
      const testServer = createServerPayload({
        name: new URL(result.url).hostname,
        url: result.url,
        token: result.token,
      });

      setTestingTarget('add');
      verifyAuth(testServer)
        .then(() => {
          Toast.show({ type: 'success', text1: 'Connected', text2: 'Connection info loaded from QR code.' });
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Connection failed.';
          Toast.show({ type: 'error', text1: 'Connection Failed', text2: message });
        })
        .finally(() => {
          setTestingTarget(null);
        });
    },
    [],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.bg,
        },
        headerBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        },
        headerButton: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        headerBackLabel: {
          color: colors.primary,
          fontSize: 17,
        },
        headerTitle: {
          ...typography.bodyMedium,
          color: colors.textPrimary,
          position: 'absolute',
          left: 0,
          right: 0,
          textAlign: 'center',
          pointerEvents: 'none',
        },
        listContent: {
          flexGrow: 1,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing['4xl'],
        },
        headerSection: {
          marginBottom: spacing.lg,
          gap: spacing.md,
        },
        addPrompt: {
          gap: spacing.sm,
        },
        addPromptRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
        },
        addPromptIcon: {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primarySubtle,
        },
        rowWrapper: {
          gap: spacing.sm,
        },
        serverCard: {
          gap: spacing.md,
        },
        serverHeader: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: spacing.md,
        },
        serverTitleBlock: {
          flex: 1,
          gap: spacing.xs,
        },
        serverMetaRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        statusPill: {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: spacing.xs,
          paddingHorizontal: spacing.sm,
          paddingVertical: 5,
          borderRadius: radii.full,
          backgroundColor: dark ? colors.surfaceHover : colors.bg,
        },
        serverUrl: {
          ...typography.mono,
          color: colors.textSecondary,
        },
        serverFooter: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        },
        serverHint: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          flex: 1,
        },
        serverActionRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          gap: spacing.sm,
          paddingLeft: spacing.sm,
        },
        serverActionButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          borderRadius: radii.full,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        serverActionButtonDanger: {
          borderColor: colors.error,
          backgroundColor: colors.errorSubtle,
        },
        serverActionLabel: {
          ...typography.smallMedium,
          color: colors.textSecondary,
        },
        serverActionLabelDanger: {
          color: colors.error,
        },
        separator: {
          height: spacing.md,
        },
        emptyState: {
          flex: 1,
          justifyContent: 'center',
          paddingVertical: spacing['4xl'],
        },
      }),
    [colors, dark, radii, spacing, typography],
  );

  const resetAddForm = () => {
    setForm(initialForm);
    setFormErrors({});
  };

  const closeAddForm = () => {
    setShowForm(false);
    resetAddForm();
  };

  const openAddForm = () => {
    setEditingServerId(null);
    resetAddForm();
    setEditForm(initialForm);
    setEditErrors({});
    setShowForm(true);
  };

  const beginEdit = (server: Server) => {
    setShowForm(false);

    if (editingServerId === server.id) {
      setEditingServerId(null);
      setEditForm(initialForm);
      setEditErrors({});
      return;
    }

    setEditingServerId(server.id);
    setEditForm({
      name: server.name,
      url: server.url,
      token: server.token,
    });
    setEditErrors({});
  };

  const cancelEdit = () => {
    setEditingServerId(null);
    setEditForm(initialForm);
    setEditErrors({});
  };

  const setAddField = (field: keyof ServerForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  };

  const setEditField = (field: keyof ServerForm, value: string) => {
    setEditForm((current) => ({ ...current, [field]: value }));
    setEditErrors((current) => ({ ...current, [field]: undefined }));
  };

  const runAuthTest = async (mode: 'add' | 'edit') => {
    const currentForm = mode === 'add' ? form : editForm;
    const nextErrors = validateForm(currentForm);

    if (hasErrors(nextErrors)) {
      if (mode === 'add') {
        setFormErrors(nextErrors);
      } else {
        setEditErrors(nextErrors);
      }
      Toast.show({ type: 'error', text1: 'Check Input', text2: 'Please fill in Name, URL, and Token correctly.' });
      return;
    }

    setTestingTarget(mode);

    try {
      await verifyAuth(createServerPayload(currentForm));
      Toast.show({ type: 'success', text1: 'Connected', text2: 'Authentication successful.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed.';
      Toast.show({ type: 'error', text1: 'Connection Failed', text2: message });
    } finally {
      setTestingTarget(null);
    }
  };

  const submitAdd = async () => {
    const nextErrors = validateForm(form);

    if (hasErrors(nextErrors)) {
      setFormErrors(nextErrors);
      Toast.show({ type: 'error', text1: 'Check Input', text2: 'Please review each field before adding.' });
      return;
    }

    setSavingTarget('add');

    try {
      const server = await addServer(form);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: 'Server Added', text2: `Saved ${server.name}.` });
      closeAddForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add server.';
      Toast.show({ type: 'error', text1: 'Add Failed', text2: message });
    } finally {
      setSavingTarget(null);
    }
  };

  const submitEdit = async () => {
    if (!editingServerId) {
      return;
    }

    const nextErrors = validateForm(editForm);

    if (hasErrors(nextErrors)) {
      setEditErrors(nextErrors);
      Toast.show({ type: 'error', text1: 'Check Input', text2: 'Please review each field before saving.' });
      return;
    }

    setSavingTarget('edit');

    try {
      await updateServer(editingServerId, editForm);
      Toast.show({ type: 'success', text1: 'Server Updated', text2: 'Changes saved.' });
      cancelEdit();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update server.';
      Toast.show({ type: 'error', text1: 'Update Failed', text2: message });
    } finally {
      setSavingTarget(null);
    }
  };

  const confirmDelete = (server: Server) => {
    Alert.alert('Delete Server', `Delete "${server.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (editingServerId === server.id) {
            cancelEdit();
          }

          void removeServer(server.id)
            .then(() => {
              Toast.show({ type: 'success', text1: 'Server Deleted', text2: `Removed ${server.name}.` });
            })
            .catch((error: unknown) => {
              const message = error instanceof Error ? error.message : 'Failed to delete server.';
              Toast.show({ type: 'error', text1: 'Delete Failed', text2: message });
            });
        },
      },
    ]);
  };

  const setDefault = async (server: Server) => {
    if (server.isDefault) {
      return;
    }

    try {
      await updateServer(server.id, { isDefault: true });
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Toast.show({ type: 'success', text1: 'Default Updated', text2: `Set ${server.name} as default.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update default server.';
      Toast.show({ type: 'error', text1: 'Update Failed', text2: message });
    }
  };

  const handleServerAccessibilityAction = useCallback(
    (server: Server, actionName: string) => {
      if (actionName === 'activate' || actionName === 'edit') {
        beginEdit(server);
        return;
      }

      if (actionName === 'set-default') {
        void setDefault(server);
        return;
      }

      if (actionName === 'delete') {
        confirmDelete(server);
      }
    },
    [beginEdit, confirmDelete, setDefault],
  );

  const header = (
    <View style={styles.headerSection}>
      {showForm ? (
        <ServerFormCard
          accent={colors.primary}
          description="Save the connection URL and auth token. You can run an auth test here too."
          errors={formErrors}
          form={form}
          saving={savingTarget === 'add'}
          submitLabel={savingTarget === 'add' ? 'Adding...' : 'Add'}
          testing={testingTarget === 'add'}
          title="Add New Server"
          onCancel={closeAddForm}
          onChange={setAddField}
          onSubmit={() => void submitAdd()}
          onTest={() => void runAuthTest('add')}
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          <Card onPress={openAddForm} style={styles.addPrompt}>
            <View style={styles.addPromptRow}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text style={[typography.heading, { color: colors.textPrimary }]}>Add Connection</Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  Add server info so you can switch connections anytime.
                </Text>
              </View>
              <View style={styles.addPromptIcon}>
                <Ionicons color={colors.primary} name="add-outline" size={22} />
              </View>
            </View>
          </Card>
          <Button
            icon={<Ionicons color={colors.textPrimary} name="qr-code-outline" size={16} />}
            label="Scan QR Code"
            variant="secondary"
            onPress={() => setShowQrScanner(true)}
          />
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.headerBar}>
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons color={colors.primary} name="chevron-back" size={22} />
          <Text style={styles.headerBackLabel}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Servers</Text>
        <Pressable
          accessibilityLabel={showForm ? 'Close form' : 'Add server'}
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => {
            if (showForm) {
              closeAddForm();
              return;
            }
            openAddForm();
          }}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Ionicons color={colors.textPrimary} name={showForm ? 'close' : 'add'} size={24} />
        </Pressable>
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >

      <FlatList
        contentContainerStyle={styles.listContent}
        data={servers}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <EmptyState
              action={{ label: 'Add Server', onPress: openAddForm }}
              description="Add a connection to get started."
              icon="server-outline"
              title="No Servers"
            />
          </View>
        }
        ListHeaderComponent={header}
        renderItem={({ item }) => {
          const isEditing = editingServerId === item.id;

          return (
            <View style={styles.rowWrapper}>
              <SwipeableRow
                leftAction={
                  item.isDefault
                    ? undefined
                    : {
                        icon: 'star-outline',
                        color: colors.primary,
                        label: 'Set as Default',
                        hapticStyle: null,
                        onPress: () => {
                          void setDefault(item);
                        },
                      }
                }
                rightAction={{
                  icon: 'trash-outline',
                  color: colors.error,
                  label: 'Delete Server',
                  onPress: () => confirmDelete(item),
                }}
              >
                <Card
                  accessibilityActions={[
                    { name: 'activate', label: 'Edit server' },
                    ...(item.isDefault ? [] : [{ name: 'set-default', label: 'Set as default' }]),
                    { name: 'delete', label: 'Delete server' },
                  ]}
                  accessibilityHint="Opens server details and quick actions."
                  accessibilityLabel={`${item.name} ${item.isDefault ? 'default' : ''}`.trim()}
                  accessibilityState={{ selected: item.isDefault }}
                  highlighted={item.isDefault}
                  onAccessibilityAction={({ nativeEvent }) => handleServerAccessibilityAction(item, nativeEvent.actionName)}
                  onLongPress={() => confirmDelete(item)}
                  onPress={() => beginEdit(item)}
                  style={styles.serverCard}
                >
                  <View style={styles.serverHeader}>
                    <View style={styles.serverTitleBlock}>
                      <Text style={[typography.heading, { color: colors.textPrimary }]}>{item.name}</Text>
                      <View style={styles.serverMetaRow}>
                        <View style={styles.statusPill}>
                          <Ionicons color={item.isDefault ? colors.primary : colors.textMuted} name="radio-button-on-outline" size={14} />
                          <Text style={[typography.smallMedium, { color: item.isDefault ? colors.primary : colors.textSecondary }]}>
                            {item.isDefault ? 'Current Default' : 'Standby'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    {item.isDefault ? <Badge label="DEFAULT" variant="primary" /> : null}
                  </View>

                  <Text style={styles.serverUrl}>{item.url}</Text>

                  <View style={styles.serverFooter}>
                    <View style={styles.serverHint}>
                      <Ionicons color={colors.textMuted} name="create-outline" size={14} />
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>{isEditing ? 'Editing' : 'Tap to edit'}</Text>
                    </View>
                    <Text style={[typography.small, { color: colors.textMuted }]}>
                      Swipe actions are still available as shortcuts.
                    </Text>
                  </View>
                </Card>
              </SwipeableRow>

              {!isEditing ? (
                <View style={styles.serverActionRow}>
                  <Pressable
                    accessibilityLabel={`Edit ${item.name}`}
                    accessibilityRole="button"
                    onPress={() => beginEdit(item)}
                    style={({ pressed }) => [styles.serverActionButton, pressed && { opacity: 0.7 }]}
                  >
                    <Ionicons color={colors.primary} name="create-outline" size={14} />
                    <Text style={styles.serverActionLabel}>Edit</Text>
                  </Pressable>
                  {!item.isDefault ? (
                    <Pressable
                      accessibilityLabel={`Set ${item.name} as default`}
                      accessibilityRole="button"
                      onPress={() => {
                        void setDefault(item);
                      }}
                      style={({ pressed }) => [styles.serverActionButton, pressed && { opacity: 0.7 }]}
                    >
                      <Ionicons color={colors.primary} name="star-outline" size={14} />
                      <Text style={styles.serverActionLabel}>Set Default</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityLabel={`Delete ${item.name}`}
                    accessibilityRole="button"
                    onPress={() => confirmDelete(item)}
                    style={({ pressed }) => [
                      styles.serverActionButton,
                      styles.serverActionButtonDanger,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Ionicons color={colors.error} name="trash-outline" size={14} />
                    <Text style={[styles.serverActionLabel, styles.serverActionLabelDanger]}>Delete</Text>
                  </Pressable>
                </View>
              ) : null}

              {isEditing ? (
                <ServerFormCard
                  accent={colors.info}
                  description="You can run an auth test before saving. Default switching is also available from the quick actions."
                  errors={editErrors}
                  form={editForm}
                  saving={savingTarget === 'edit'}
                  style={{ marginLeft: spacing.sm }}
                  submitLabel={savingTarget === 'edit' ? 'Saving...' : 'Save'}
                  testing={testingTarget === 'edit'}
                  title={`Edit ${item.name}`}
                  onCancel={cancelEdit}
                  onChange={setEditField}
                  onSubmit={() => void submitEdit()}
                  onTest={() => void runAuthTest('edit')}
                />
              ) : null}
            </View>
          );
        }}
      />

      <QrScannerModal
        visible={showQrScanner}
        onClose={() => setShowQrScanner(false)}
        onManualEntry={openAddForm}
        onScan={handleQrScan}
      />
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
