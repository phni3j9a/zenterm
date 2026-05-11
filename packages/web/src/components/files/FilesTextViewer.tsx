import { useTranslation } from 'react-i18next';
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { useTheme } from '@/theme';

export function FilesTextViewer() {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const textContent = useFilesPreviewStore((s) => s.textContent);
  const textLines = useFilesPreviewStore((s) => s.textLines);
  const textTruncated = useFilesPreviewStore((s) => s.textTruncated);

  if (textContent === null) return null;

  const lines = textContent.split('\n');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <pre
        style={{
          flex: 1,
          margin: 0,
          padding: tokens.spacing.md,
          overflow: 'auto',
          background: tokens.colors.bg,
          color: tokens.colors.textPrimary,
          fontFamily: tokens.typography.mono.fontFamily,
          fontSize: tokens.typography.bodyMedium.fontSize,
          lineHeight: 1.5,
          whiteSpace: 'pre',
        }}
      >
        {lines.map((line, i) => (
          <div key={i} style={{ display: 'flex' }}>
            <span
              style={{
                color: tokens.colors.textMuted,
                paddingRight: tokens.spacing.md,
                userSelect: 'none',
                minWidth: 40,
                textAlign: 'right' as const,
              }}
            >
              {i + 1}
            </span>
            <span>{line}</span>
          </div>
        ))}
      </pre>
      {textTruncated && (
        <div
          role="status"
          style={{
            padding: `${tokens.spacing.xs}px ${tokens.spacing.md}px`,
            borderTop: `1px solid ${tokens.colors.borderSubtle}`,
            background: tokens.colors.bgElevated,
            color: tokens.colors.warning,
            fontSize: tokens.typography.caption.fontSize,
          }}
        >
          {t('files.truncatedIndicator', { lines: textLines })}
        </div>
      )}
    </div>
  );
}
