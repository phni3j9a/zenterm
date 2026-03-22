import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { SpecialKeys } from './SpecialKeys';
import { TerminalWebView, type TerminalWebViewHandle } from './TerminalWebView';
import { useTheme } from '@/src/theme';
import { terminalColorsLight, terminalColorsDark } from '@/src/theme/tokens';
import type { Server } from '@/src/types';

interface Props {
  server: Server;
  sessionId: string;
  onStatusChange?: (status: 'connected' | 'disconnected' | 'error' | 'reconnecting') => void;
}

export function InlineTerminal({ server, sessionId, onStatusChange }: Props) {
  const terminalRef = useRef<TerminalWebViewHandle>(null);
  const { dark } = useTheme();
  const termBg = dark ? terminalColorsDark.bg : terminalColorsLight.bg;
  const handleKeyPress = (data: string, options?: { noFocus?: boolean }) => {
    terminalRef.current?.sendInput(data, options);
  };

  return (
    <View style={[styles.root, { backgroundColor: termBg }]}>
      <TerminalWebView
        ref={terminalRef}
        server={server}
        sessionId={sessionId}
        onStatusChange={onStatusChange}
      />
      <SpecialKeys onKeyPress={handleKeyPress} server={server} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
