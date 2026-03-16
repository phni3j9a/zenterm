import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import type { Server } from '@/src/types';
import { useSettingsStore } from '@/src/stores/settings';
import { terminalColors } from '@/src/theme/tokens';

export interface TerminalWebViewHandle {
  sendInput: (data: string) => void;
}

interface Props {
  server: Server;
  sessionId: string;
  onStatusChange?: (status: 'connected' | 'disconnected' | 'error' | 'reconnecting') => void;
}

const getBaseUrl = (url: string) => url.replace(/\/+$/, '');

export const TerminalWebView = forwardRef<TerminalWebViewHandle, Props>(
  ({ server, sessionId, onStatusChange }, ref) => {
    const webViewRef = useRef<WebView>(null);
    const fontSize = useSettingsStore((state) => state.settings.fontSize);
    const terminalTheme = 'dark';
    const uri = `${getBaseUrl(server.url)}/embed/terminal?sessionId=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(server.token)}&fontSize=${encodeURIComponent(String(fontSize))}&theme=${encodeURIComponent(terminalTheme)}`;

    const onMessage = useCallback(
      (event: WebViewMessageEvent) => {
        try {
          const msg = JSON.parse(event.nativeEvent.data);
          if (
            msg.type === 'connected' ||
            msg.type === 'disconnected' ||
            msg.type === 'error' ||
            msg.type === 'reconnecting'
          ) {
            onStatusChange?.(msg.type);
          }
        } catch {
          // Ignore invalid bridge messages from the page.
        }
      },
      [onStatusChange],
    );

    const sendInput = useCallback((data: string) => {
      webViewRef.current?.injectJavaScript(
        `handleBridgeMessage(JSON.stringify({ type: 'input', data: ${JSON.stringify(data)} })); true;`,
      );
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        sendInput,
      }),
      [sendInput],
    );

    return (
      <WebView
        ref={webViewRef}
        source={{ uri }}
        onMessage={onMessage}
        onError={(e) => {
          console.warn('WebView error:', e.nativeEvent);
          onStatusChange?.('error');
        }}
        onHttpError={(e) => {
          console.warn('WebView HTTP error:', e.nativeEvent.statusCode);
          onStatusChange?.('error');
        }}
        style={{ flex: 1, backgroundColor: terminalColors.bg }}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        keyboardDisplayRequiresUserAction={false}
        originWhitelist={['*']}
        mixedContentMode="always"
        allowsBackForwardNavigationGestures={false}
      />
    );
  },
);

TerminalWebView.displayName = 'TerminalWebView';
