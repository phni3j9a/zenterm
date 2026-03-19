import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Toast from 'react-native-toast-message';

import { verifyAuth } from '@/src/api/client';
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
    errors.name = 'サーバー名を入力してください。';
  }

  if (!form.url.trim()) {
    errors.url = 'URL を入力してください。';
  } else if (!urlPattern.test(form.url.trim())) {
    errors.url = 'http:// または https:// で始めてください。';
  }

  if (!form.token.trim()) {
    errors.token = 'Token を入力してください。';
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
          label={testing ? '認証確認中...' : '認証テスト'}
          loading={testing}
          variant="secondary"
          onPress={onTest}
        />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button disabled={saving || testing} label="キャンセル" variant="ghost" onPress={onCancel} />
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
  const { colors, dark, radii, shadows, spacing, typography } = useTheme();
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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.bg,
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
          ...(dark ? {} : shadows.sm),
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
          borderWidth: 1,
          borderColor: dark ? colors.border : colors.borderSubtle,
        },
        serverUrl: {
          ...typography.mono,
          color: colors.textSecondary,
        },
        serverFooter: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
        },
        serverHint: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          flex: 1,
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
    [colors, dark, radii, shadows, spacing, typography],
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
      Toast.show({ type: 'error', text1: '入力を確認してください', text2: 'Name、URL、Token を正しく入力してください。' });
      return;
    }

    setTestingTarget(mode);

    try {
      await verifyAuth(createServerPayload(currentForm));
      Toast.show({ type: 'success', text1: '接続成功', text2: '認証に成功しました。' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '接続に失敗しました。';
      Toast.show({ type: 'error', text1: '接続失敗', text2: message });
    } finally {
      setTestingTarget(null);
    }
  };

  const submitAdd = async () => {
    const nextErrors = validateForm(form);

    if (hasErrors(nextErrors)) {
      setFormErrors(nextErrors);
      Toast.show({ type: 'error', text1: '入力を確認してください', text2: '追加前に各項目を見直してください。' });
      return;
    }

    setSavingTarget('add');

    try {
      const server = await addServer(form);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: 'サーバーを追加しました', text2: `${server.name} を保存しました。` });
      closeAddForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'サーバーを追加できませんでした。';
      Toast.show({ type: 'error', text1: '追加失敗', text2: message });
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
      Toast.show({ type: 'error', text1: '入力を確認してください', text2: '保存前に各項目を見直してください。' });
      return;
    }

    setSavingTarget('edit');

    try {
      await updateServer(editingServerId, editForm);
      Toast.show({ type: 'success', text1: 'サーバーを更新しました', text2: '保存内容を反映しました。' });
      cancelEdit();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'サーバーを更新できませんでした。';
      Toast.show({ type: 'error', text1: '更新失敗', text2: message });
    } finally {
      setSavingTarget(null);
    }
  };

  const confirmDelete = (server: Server) => {
    Alert.alert('サーバー削除', `${server.name} を削除しますか。`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          if (editingServerId === server.id) {
            cancelEdit();
          }

          void removeServer(server.id)
            .then(() => {
              Toast.show({ type: 'success', text1: 'サーバーを削除しました', text2: `${server.name} を一覧から削除しました。` });
            })
            .catch((error: unknown) => {
              const message = error instanceof Error ? error.message : 'サーバーを削除できませんでした。';
              Toast.show({ type: 'error', text1: '削除失敗', text2: message });
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
      Toast.show({ type: 'success', text1: 'デフォルトを更新しました', text2: `${server.name} を標準接続先に設定しました。` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'デフォルトサーバーを更新できませんでした。';
      Toast.show({ type: 'error', text1: '更新失敗', text2: message });
    }
  };

  const header = (
    <View style={styles.headerSection}>
      {showForm ? (
        <ServerFormCard
          accent={colors.primary}
          description="接続先 URL と認証 token を保存し、認証テストまでここで完結できます。"
          errors={formErrors}
          form={form}
          saving={savingTarget === 'add'}
          submitLabel={savingTarget === 'add' ? '追加中...' : '追加'}
          testing={testingTarget === 'add'}
          title="新しいサーバーを追加"
          onCancel={closeAddForm}
          onChange={setAddField}
          onSubmit={() => void submitAdd()}
          onTest={() => void runAuthTest('add')}
        />
      ) : (
        <Card onPress={openAddForm} style={styles.addPrompt}>
          <View style={styles.addPromptRow}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text style={[typography.heading, { color: colors.textPrimary }]}>新しい接続先を登録</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                サーバー情報を追加して、必要なときにすぐ切り替えられる状態にします。
              </Text>
            </View>
            <View style={styles.addPromptIcon}>
              <Ionicons color={colors.primary} name="add-outline" size={22} />
            </View>
          </View>
        </Card>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'サーバー管理',
          headerRight: () => (
            <Pressable
              accessibilityLabel={showForm ? 'フォームを閉じる' : 'サーバーを追加'}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                if (showForm) {
                  closeAddForm();
                  return;
                }

                openAddForm();
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Ionicons color={colors.textPrimary} name={showForm ? 'close' : 'add'} size={22} />
            </Pressable>
          ),
        }}
      />

      <FlatList
        contentContainerStyle={styles.listContent}
        data={servers}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <EmptyState
              action={{ label: 'サーバーを追加', onPress: openAddForm }}
              description="接続先を追加して開始しましょう"
              icon="server-outline"
              title="サーバーがありません"
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
                        label: 'デフォルトに設定',
                        hapticStyle: null,
                        onPress: () => {
                          void setDefault(item);
                        },
                      }
                }
                rightAction={{
                  icon: 'trash-outline',
                  color: colors.error,
                  label: 'サーバーを削除',
                  onPress: () => confirmDelete(item),
                }}
              >
                <Card
                  accessibilityLabel={`${item.name} ${item.isDefault ? 'デフォルト' : ''}`.trim()}
                  highlighted={item.isDefault}
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
                            {item.isDefault ? '現在のデフォルト' : '待機中'}
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
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>{isEditing ? '編集中です' : 'タップで編集'}</Text>
                    </View>
                    <Text style={[typography.small, { color: colors.textMuted }]}>
                      {item.isDefault ? '左スワイプで削除' : '右スワイプで標準化'}
                    </Text>
                  </View>
                </Card>
              </SwipeableRow>

              {isEditing ? (
                <ServerFormCard
                  accent={colors.info}
                  description="保存前に認証テストも実行できます。デフォルト設定はスワイプ操作で変更してください。"
                  errors={editErrors}
                  form={editForm}
                  saving={savingTarget === 'edit'}
                  style={{ marginLeft: spacing.sm }}
                  submitLabel={savingTarget === 'edit' ? '保存中...' : '保存'}
                  testing={testingTarget === 'edit'}
                  title={`${item.name} を編集`}
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
    </View>
  );
}
