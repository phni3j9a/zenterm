import { lazy, Suspense } from 'react';
import { useTheme } from '@/theme';

const Markdown = lazy(async () => {
  const [{ default: ReactMarkdown }, { default: remarkGfm }] = await Promise.all([
    import('react-markdown'),
    import('remark-gfm'),
  ]);
  function MarkdownInner({ children }: { children: string }) {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => (url.startsWith('javascript:') ? '' : url)}
      >
        {children}
      </ReactMarkdown>
    );
  }
  return { default: MarkdownInner };
});

interface Props { source: string; }

export function FilesMarkdownViewer({ source }: Props) {
  const { tokens } = useTheme();
  return (
    <div
      aria-label="Markdown preview"
      style={{
        flex: 1,
        overflow: 'auto',
        padding: tokens.spacing.lg,
        background: tokens.colors.bg,
        color: tokens.colors.textPrimary,
        lineHeight: 1.6,
      }}
    >
      <Suspense fallback={<span style={{ color: tokens.colors.textMuted }}>Loading…</span>}>
        <Markdown>{source}</Markdown>
      </Suspense>
    </div>
  );
}
