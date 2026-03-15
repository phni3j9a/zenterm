import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Not Found',
          headerStyle: { backgroundColor: Colors.dark.card },
          headerTintColor: Colors.dark.text,
        }}
      />
      <View style={styles.container}>
        <Text style={styles.title}>ページが見つかりません。</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>トップへ戻る</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: Colors.dark.background,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
    color: Colors.dark.tint,
  },
});
