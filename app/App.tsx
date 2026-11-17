import React, { useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SignInScreen, WalletScreen, PropertiesScreen, PortfolioScreen, ProfileScreen } from './src/screens';

type Tab = 'wallet' | 'properties' | 'portfolio' | 'profile';
const TABS: Tab[] = ['wallet', 'properties', 'portfolio', 'profile'];

export default function App() {
  const [email, setEmail] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('wallet');

  if (!email) return <SafeAreaView style={s.root}><SignInScreen onSignedIn={setEmail} /></SafeAreaView>;

  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="auto" />
      <View style={s.body}>
        {tab === 'wallet' && <WalletScreen />}
        {tab === 'properties' && <PropertiesScreen />}
        {tab === 'portfolio' && <PortfolioScreen />}
        {tab === 'profile' && <ProfileScreen email={email} onSignOut={() => setEmail(null)} />}
      </View>
      <View style={s.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity key={t} testID={`tab-${t}`} onPress={() => setTab(t)} style={s.tab}>
            <Text style={tab === t ? s.active : undefined}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  body: { flex: 1, padding: 16 },
  tabs: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#ddd' },
  tab: { flex: 1, padding: 14, alignItems: 'center' },
  active: { fontWeight: '700' },
});
