import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import Colors from '@/constants/Colors';

interface Props {
  onKeyPress: (data: string) => void;
}

const KEYS = [
  { label: 'Esc', data: '\x1b' },
  { label: 'Tab', data: '\t' },
  { label: 'Ctrl+C', data: '\x03' },
];

export function SpecialKeys({ onKeyPress }: Props) {
  return (
    <View style={styles.container}>
      {KEYS.map((key) => (
        <TouchableOpacity key={key.label} style={styles.button} onPress={() => onKeyPress(key.data)}>
          <Text style={styles.label}>{key.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.dark.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.dark.border,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.dark.cardMuted,
  },
  label: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
