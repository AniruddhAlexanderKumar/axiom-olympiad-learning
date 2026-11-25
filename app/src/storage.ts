import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'axiom.token';

export async function saveToken(token: string | null): Promise<void> {
  try {
    if (token) await AsyncStorage.setItem(KEY, token);
    else await AsyncStorage.removeItem(KEY);
  } catch {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      if (token) localStorage.setItem(KEY, token);
      else localStorage.removeItem(KEY);
    }
  }
}

export async function readToken(): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(KEY);
    if (value) return value;
  } catch {
    // fall through to web storage
  }
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') return localStorage.getItem(KEY);
  return null;
}
