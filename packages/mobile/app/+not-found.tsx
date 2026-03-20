import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

export default function NotFoundScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(tabs)/sessions');
  }, [router]);

  return <View style={{ flex: 1 }} />;
}
