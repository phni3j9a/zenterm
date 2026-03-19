import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import Toast from 'react-native-toast-message';

import { listFiles, getFileContent, writeFileContent } from '@/src/api/client';
import { SetupGuide } from '@/src/components/SetupGuide';
import { EmptyState, SkeletonLoader } from '@/src/components/ui';
import { useServersStore } from '@/src/stores/servers';
import { useTheme } from '@/src/theme';
import { terminalColorsLight, terminalColorsDark } from '@/src/theme/tokens';
import type { FileEntry } from '@/src/types';

type SortMode = 'name-asc' | 'name-desc' | 'size-desc' | 'modified-desc';

interface FilePreview {
  path: string;
  content: string;
  lines: number;
  truncated: boolean;
}

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.sh', '.json', '.yaml', '.yml', '.toml', '.md',
]);

const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp',
]);

type FileIconType = 'folder' | 'code' | 'image' | 'text' | 'symlink' | 'other';

function getFileIconType(entry: FileEntry): FileIconType {
  if (entry.type === 'directory') return 'folder';
  if (entry.type === 'symlink') return 'symlink';
  if (entry.type === 'other') return 'other';

  const ext = entry.name.includes('.') ? `.${entry.name.split('.').pop()?.toLowerCase()}` : '';
  if (CODE_EXTENSIONS.has(ext)) return 'code';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  return 'text';
}

const formatFileDate = (modified: number): string => {
  const timestamp = modified < 1_000_000_000_000 ? modified * 1000 : modified;
  return new Date(timestamp).toLocaleString('ja-JP');
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

function sortFiles(entries: FileEntry[], mode: SortMode): FileEntry[] {
  const dirs = entries.filter((e) => e.type === 'directory');
  const rest = entries.filter((e) => e.type !== 'directory');

  const sortFn = (a: FileEntry, b: FileEntry): number => {
    switch (mode) {
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'name-desc':
        return b.name.localeCompare(a.name);
      case 'size-desc':
        return b.size - a.size;
      case 'modified-desc':
        return b.modified - a.modified;
    }
  };

  return [...dirs.sort(sortFn), ...rest.sort(sortFn)];
}

export default function FilesScreen() {
  const server = useServersStore((state) => state.getDefaultServer());
  const { colors, dark, radii, spacing, typography } = useTheme();
  const termBgColor = dark ? terminalColorsDark.bg : terminalColorsLight.bg;

  const [currentPath, setCurrentPath] = useState('~');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<FilePreview | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('name-asc');
  const [, setPreviewLoading] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [showMarkdown, setShowMarkdown] = useState(false);
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.bg,
        },
        headerActions: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        },
        breadcrumbBar: {
          height: 44,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.borderSubtle,
        },
        breadcrumbScroll: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
        },
        breadcrumbSegment: {
          ...typography.caption,
          color: colors.textSecondary,
        },
        breadcrumbActive: {
          ...typography.captionMedium,
          color: colors.textPrimary,
        },
        newFileBar: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          gap: spacing.sm,
          backgroundColor: colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.borderSubtle,
        },
        newFileInput: {
          flex: 1,
          ...typography.body,
          color: colors.textPrimary,
          padding: spacing.sm,
          borderRadius: radii.sm,
          backgroundColor: colors.bg,
          borderWidth: 1,
          borderColor: colors.border,
        },
        listContent: {
          flexGrow: 1,
        },
        fileItem: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.borderSubtle,
          gap: spacing.md,
        },
        fileItemPressed: {
          backgroundColor: colors.surfaceHover,
        },
        fileIcon: {
          width: 40,
          height: 40,
          borderRadius: radii.md,
          padding: spacing.sm,
          alignItems: 'center',
          justifyContent: 'center',
        },
        fileInfo: {
          flex: 1,
          gap: 2,
        },
        fileName: {
          ...typography.body,
          color: colors.textPrimary,
        },
        fileSubtitle: {
          ...typography.small,
          color: colors.textMuted,
        },
        fileSize: {
          ...typography.caption,
          color: colors.textMuted,
        },
        emptyContainer: {
          flex: 1,
          justifyContent: 'center',
        },
        skeletonContainer: {
          padding: spacing.lg,
          gap: spacing.md,
        },
        modalContainer: {
          flex: 1,
          backgroundColor: termBgColor,
        },
        modalHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: dark ? colors.surface : colors.bg,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.borderSubtle,
        },
        modalTitle: {
          ...typography.bodyMedium,
          color: colors.textPrimary,
          flex: 1,
          marginHorizontal: spacing.md,
        },
        modalContent: {
          flex: 1,
          backgroundColor: termBgColor,
        },
        modalCodeScroll: {
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        },
        markdownContent: {
          padding: spacing.lg,
        },
        editorInput: {
          ...typography.mono,
          color: colors.textPrimary,
          padding: spacing.lg,
          minHeight: 400,
          textAlignVertical: 'top',
        },
        codeLine: {
          flexDirection: 'row',
        },
        lineNumber: {
          ...typography.mono,
          color: colors.textMuted,
          width: 44,
          textAlign: 'right',
          marginRight: spacing.md,
        },
        lineContent: {
          ...typography.mono,
          color: colors.textPrimary,
          flex: 1,
        },
        truncatedIndicator: {
          ...typography.caption,
          color: colors.warning,
          textAlign: 'center',
          paddingVertical: spacing.md,
        },
      }),
    [colors, dark, radii, spacing, termBgColor, typography],
  );

  const markdownStyles = useMemo(
    () => ({
      body: { color: colors.textPrimary },
      heading1: { color: colors.textPrimary },
      heading2: { color: colors.textPrimary },
      heading3: { color: colors.textPrimary },
      paragraph: { color: colors.textPrimary },
      link: { color: colors.primary },
      blockquote: { backgroundColor: colors.surface, borderColor: colors.border },
      code_inline: { backgroundColor: colors.surface, color: colors.textPrimary },
      code_block: { backgroundColor: colors.surface, color: colors.textPrimary },
      fence: { backgroundColor: colors.surface, color: colors.textPrimary },
    }),
    [colors],
  );

  const loadFiles = useCallback(
    async (path: string) => {
      if (!server) return;
      setLoading(true);
      setError(null);
      try {
        const data = await listFiles(server, path, showHidden);
        setFiles(data.entries);
        setCurrentPath(data.path);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'ファイル一覧を取得できませんでした。';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [server, showHidden],
  );

  const loadedRef = useCallback(
    (path: string) => {
      void loadFiles(path);
    },
    [loadFiles],
  );

  const [initialLoaded, setInitialLoaded] = useState(false);
  if (!initialLoaded && server) {
    setInitialLoaded(true);
    loadedRef(currentPath);
  }

  const toggleShowHidden = useCallback(() => {
    setShowHidden((prev) => {
      const next = !prev;
      if (server) {
        void (async () => {
          setLoading(true);
          try {
            const data = await listFiles(server, currentPath, next);
            setFiles(data.entries);
            setCurrentPath(data.path);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'ファイル一覧を取得できませんでした。';
            setError(message);
          } finally {
            setLoading(false);
          }
        })();
      }
      return next;
    });
  }, [server, currentPath]);

  const navigateTo = useCallback(
    (path: string) => {
      void loadFiles(path);
    },
    [loadFiles],
  );

  const closePreview = useCallback(() => {
    setPreviewFile(null);
    setIsEditing(false);
  }, []);

  const openFile = useCallback(
    async (entry: FileEntry) => {
      if (!server) return;

      const iconType = getFileIconType(entry);
      if (iconType !== 'text' && iconType !== 'code') {
        Toast.show({
          type: 'info',
          text1: 'プレビューできません',
          text2: `${entry.name} はプレビューに対応していません。`,
        });
        return;
      }

      setPreviewLoading(true);
      try {
        const filePath = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`;
        const data = await getFileContent(server, filePath);
        setPreviewFile({
          path: data.path,
          content: data.content,
          lines: data.lines,
          truncated: data.truncated,
        });
        setIsEditing(false);
        setShowMarkdown(entry.name.endsWith('.md'));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'ファイルを読み込めませんでした。';
        Toast.show({ type: 'error', text1: '読み込み失敗', text2: message });
      } finally {
        setPreviewLoading(false);
      }
    },
    [currentPath, server],
  );

  const handleSave = useCallback(async () => {
    if (!server || !previewFile) return;
    setSaving(true);
    try {
      await writeFileContent(server, previewFile.path, editContent);
      setPreviewFile({
        ...previewFile,
        content: editContent,
        lines: editContent.split('\n').length,
        truncated: false,
      });
      setIsEditing(false);
      Toast.show({ type: 'success', text1: '保存しました' });
      void loadFiles(currentPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ファイルを保存できませんでした。';
      Toast.show({ type: 'error', text1: '保存失敗', text2: message });
    } finally {
      setSaving(false);
    }
  }, [server, previewFile, editContent, currentPath, loadFiles]);

  const handleFilePress = useCallback(
    (entry: FileEntry) => {
      if (entry.type === 'directory') {
        const nextPath = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`;
        navigateTo(nextPath);
        return;
      }

      if (entry.type === 'file' || entry.type === 'symlink') {
        void openFile(entry);
        return;
      }

      Toast.show({
        type: 'info',
        text1: 'プレビューできません',
        text2: `${entry.name} はプレビューに対応していません。`,
      });
    },
    [currentPath, navigateTo, openFile],
  );

  const sortedFiles = useMemo(() => sortFiles(files, sortMode), [files, sortMode]);

  const pathSegments = useMemo(() => {
    if (currentPath === '~' || currentPath === '') return [];
    const normalized = currentPath.startsWith('~') ? currentPath : currentPath;
    const parts = normalized.split('/').filter(Boolean);
    if (currentPath.startsWith('~')) {
      return ['~', ...parts.slice(1)];
    }
    return parts;
  }, [currentPath]);

  const getIconConfig = (iconType: FileIconType) => {
    switch (iconType) {
      case 'folder':
        return { name: 'folder-outline' as const, color: colors.primary, bg: colors.primarySubtle };
      case 'code':
        return { name: 'code-slash-outline' as const, color: colors.success, bg: colors.successSubtle };
      case 'image':
        return { name: 'image-outline' as const, color: colors.info, bg: colors.infoSubtle };
      case 'symlink':
        return { name: 'link-outline' as const, color: colors.warning, bg: colors.warningSubtle };
      case 'text':
        return { name: 'document-text-outline' as const, color: colors.textSecondary, bg: colors.surface };
      case 'other':
      default:
        return { name: 'document-outline' as const, color: colors.textMuted, bg: colors.surface };
    }
  };

  const showSortPicker = useCallback(() => {
    const options = ['名前 (A→Z)', '名前 (Z→A)', 'サイズ (大きい順)', '更新日 (新しい順)', 'キャンセル'];
    const modeMap: SortMode[] = ['name-asc', 'name-desc', 'size-desc', 'modified-desc'];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: options.length - 1, title: '並べ替え' },
        (buttonIndex) => {
          if (buttonIndex < modeMap.length) {
            setSortMode(modeMap[buttonIndex]);
          }
        },
      );
      return;
    }

    Alert.alert('並べ替え', undefined, [
      ...modeMap.map((mode, index) => ({
        text: `${sortMode === mode ? '✓ ' : ''}${options[index]}`,
        onPress: () => setSortMode(mode),
      })),
      { text: 'キャンセル', style: 'cancel' as const },
    ]);
  }, [sortMode]);

  const openNewFileInput = useCallback(() => {
    setShowNewFileInput(true);
  }, []);

  const closeNewFileInput = useCallback(() => {
    setShowNewFileInput(false);
    setNewFileName('');
  }, []);

  const openNewFileEditor = useCallback((fileName: string) => {
    const path = currentPath === '/' ? `/${fileName}` : `${currentPath}/${fileName}`;
    setPreviewFile({ path, content: '', lines: 0, truncated: false });
    setIsEditing(true);
    setEditContent('');
    setShowMarkdown(fileName.endsWith('.md'));
    setShowNewFileInput(false);
    setNewFileName('');
  }, [currentPath]);

  const confirmNewFile = useCallback(() => {
    const trimmed = newFileName.trim();
    if (!trimmed) return;
    const exists = files.some((file) => file.name === trimmed && file.type === 'file');
    if (!exists) {
      openNewFileEditor(trimmed);
      return;
    }
    Alert.alert('上書き確認', `${trimmed} は既に存在します。上書きしますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '上書き', style: 'destructive', onPress: () => openNewFileEditor(trimmed) },
    ]);
  }, [files, newFileName, openNewFileEditor]);

  const startEditing = useCallback(() => {
    setIsEditing(true);
    setEditContent(previewFile?.content ?? '');
  }, [previewFile]);

  const renderBreadcrumbs = () => (
    <View style={styles.breadcrumbBar}>
      <ScrollView
        horizontal
        contentContainerStyle={styles.breadcrumbScroll}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        <Pressable hitSlop={8} onPress={() => navigateTo('~')}>
          <Ionicons color={colors.textSecondary} name="home-outline" size={16} />
        </Pressable>
        {pathSegments.map((segment, index) => {
          const isLast = index === pathSegments.length - 1;
          const segmentPath = pathSegments.slice(0, index + 1).join('/');

          return (
            <View key={segmentPath} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Ionicons color={colors.textMuted} name="chevron-forward" size={12} />
              <Pressable hitSlop={4} onPress={isLast ? undefined : () => navigateTo(segmentPath)}>
                <Text style={isLast ? styles.breadcrumbActive : styles.breadcrumbSegment}>
                  {segment}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
      <Pressable
        accessibilityLabel="新規ファイル作成"
        hitSlop={8}
        onPress={openNewFileInput}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, paddingLeft: spacing.sm })}
      >
        <Ionicons color={colors.primary} name="add-circle-outline" size={20} />
      </Pressable>
    </View>
  );

  const renderFileItem = ({ item }: { item: FileEntry }) => {
    const iconType = getFileIconType(item);
    const icon = getIconConfig(iconType);
    const subtitle =
      item.type === 'symlink' && item.symlinkTarget
        ? `-> ${item.symlinkTarget}`
        : item.type === 'file'
          ? formatFileDate(item.modified)
          : undefined;

    return (
      <Pressable
        onPress={() => handleFilePress(item)}
        style={({ pressed }) => [styles.fileItem, pressed && styles.fileItemPressed]}
      >
        <View style={[styles.fileIcon, { backgroundColor: icon.bg }]}>
          <Ionicons color={icon.color} name={icon.name} size={20} />
        </View>

        <View style={styles.fileInfo}>
          <Text numberOfLines={1} style={styles.fileName}>
            {item.name}
          </Text>
          {subtitle ? <Text numberOfLines={1} style={styles.fileSubtitle}>{subtitle}</Text> : null}
        </View>

        {item.type === 'file' ? (
          <Text style={styles.fileSize}>{formatFileSize(item.size)}</Text>
        ) : item.type === 'directory' ? (
          <Ionicons color={colors.textMuted} name="chevron-forward" size={16} />
        ) : null}
      </Pressable>
    );
  };

  const previewLines = useMemo(() => {
    if (!previewFile) return [];
    return previewFile.content.split('\n');
  }, [previewFile]);

  const previewFileName = useMemo(() => {
    if (!previewFile) return '';
    const parts = previewFile.path.split('/');
    return parts[parts.length - 1] || previewFile.path;
  }, [previewFile]);

  if (!server) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Files' }} />
        <SetupGuide />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Files',
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable
                accessibilityLabel="隠しファイル切替"
                accessibilityRole="button"
                hitSlop={8}
                onPress={toggleShowHidden}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Ionicons
                  color={showHidden ? colors.primary : colors.textPrimary}
                  name={showHidden ? 'eye-outline' : 'eye-off-outline'}
                  size={22}
                />
              </Pressable>
              <Pressable
                accessibilityLabel="ソート切替"
                accessibilityRole="button"
                hitSlop={8}
                onPress={showSortPicker}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Ionicons color={colors.textPrimary} name="swap-vertical-outline" size={22} />
              </Pressable>
            </View>
          ),
        }}
      />

      {renderBreadcrumbs()}

      {showNewFileInput ? (
        <View style={styles.newFileBar}>
          <TextInput
            autoFocus
            onChangeText={setNewFileName}
            placeholder="ファイル名"
            placeholderTextColor={colors.textMuted}
            style={styles.newFileInput}
            value={newFileName}
          />
          <Pressable onPress={confirmNewFile}>
            <Ionicons color={colors.primary} name="checkmark-circle" size={24} />
          </Pressable>
          <Pressable onPress={closeNewFileInput}>
            <Ionicons color={colors.textMuted} name="close-circle" size={24} />
          </Pressable>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.skeletonContainer}>
          {Array.from({ length: 8 }).map((_, index) => (
            <SkeletonLoader key={index} height={52} radius={radii.md} width="100%" />
          ))}
        </View>
      ) : (
        <FlatList
          contentContainerStyle={[styles.listContent, sortedFiles.length === 0 && styles.emptyContainer]}
          data={sortedFiles}
          keyExtractor={(item) => `${item.name}-${item.type}`}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            error ? (
              <EmptyState
                action={{ label: '再試行', onPress: () => navigateTo(currentPath) }}
                description={error}
                icon="cloud-offline-outline"
                title="ファイルを取得できません"
              />
            ) : (
              <EmptyState
                description="このディレクトリにはファイルがありません"
                icon="folder-open-outline"
                title="空のディレクトリ"
              />
            )
          }
          renderItem={renderFileItem}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        animationType="slide"
        onRequestClose={closePreview}
        presentationStyle="pageSheet"
        visible={previewFile !== null}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable hitSlop={12} onPress={closePreview}>
              <Ionicons color={colors.textSecondary} name="close" size={22} />
            </Pressable>
            <Text numberOfLines={1} style={styles.modalTitle}>
              {previewFileName}
            </Text>
            <View style={styles.headerActions}>
              {previewFileName.endsWith('.md') && !isEditing ? (
                <Pressable hitSlop={8} onPress={() => setShowMarkdown((prev) => !prev)}>
                  <Ionicons
                    color={colors.textSecondary}
                    name={showMarkdown ? 'code-slash-outline' : 'book-outline'}
                    size={20}
                  />
                </Pressable>
              ) : null}
              {isEditing ? (
                <Pressable hitSlop={8} onPress={() => void handleSave()} disabled={saving}>
                  <Ionicons color={saving ? colors.textMuted : colors.primary} name="checkmark" size={22} />
                </Pressable>
              ) : !previewFile?.truncated ? (
                <Pressable hitSlop={8} onPress={startEditing}>
                  <Ionicons color={colors.textSecondary} name="create-outline" size={20} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {isEditing ? (
            <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                onChangeText={setEditContent}
                style={styles.editorInput}
                value={editContent}
              />
            </ScrollView>
          ) : showMarkdown && previewFile ? (
            <ScrollView contentContainerStyle={styles.markdownContent} style={styles.modalContent}>
              <Markdown style={markdownStyles}>{previewFile.content}</Markdown>
            </ScrollView>
          ) : (
            <ScrollView
              contentContainerStyle={styles.modalCodeScroll}
              horizontal={false}
              style={styles.modalContent}
            >
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  {previewLines.map((line, index) => (
                    <View key={index} style={styles.codeLine}>
                      <Text style={styles.lineNumber}>{index + 1}</Text>
                      <Text style={styles.lineContent}>{line || ' '}</Text>
                    </View>
                  ))}
                  {previewFile?.truncated ? (
                    <Text style={styles.truncatedIndicator}>
                      ... truncated ({previewFile.lines} lines total)
                    </Text>
                  ) : null}
                </View>
              </ScrollView>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}
