import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import type { Server } from '@/src/types';

export interface TerminalWebViewHandle {
  sendInput: (data: string) => void;
}

interface Props {
  server: Server;
  sessionId: string;
  onStatusChange?: (status: 'connected' | 'disconnected' | 'error') => void;
}

const getBaseUrl = (url: string) => url.replace(/\/+$/, '');

export const TerminalWebView = forwardRef<TerminalWebViewHandle, Props>(
  ({ server, sessionId, onStatusChange }, ref) => {
    const webViewRef = useRef<WebView>(null);
    const uri = `${getBaseUrl(server.url)}/embed/terminal?sessionId=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(server.token)}`;

    const onMessage = useCallback(
      (event: WebViewMessageEvent) => {
        try {
          const msg = JSON.parse(event.nativeEvent.data);
          if (msg.type === 'connected' || msg.type === 'disconnected' || msg.type === 'error') {
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
        style={{ flex: 1, backgroundColor: '#1a1915' }}
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
