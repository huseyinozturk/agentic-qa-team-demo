import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { api, setToken, Property, Portfolio } from './api';

// Every interactive element has a kebab-case testID (checked by `runner lint`).

const Button = ({ id, label, onPress }: { id: string; label: string; onPress: () => void }) => (
  <TouchableOpacity testID={id} onPress={onPress} style={s.button}><Text style={s.buttonText}>{label}</Text></TouchableOpacity>
);

export function SignInScreen({ onSignedIn }: { onSignedIn: (email: string) => void }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sent || delivered) return;
    const t = setInterval(async () => {
      const r = await api.otpDelivered(email);
      if (r.data.delivered) setDelivered(true);
    }, 500);
    return () => clearInterval(t);
  }, [sent, delivered, email]);

  const send = async () => { setError(''); setDelivered(false); await api.requestOtp(email); setSent(true); };
  const verify = async () => {
    const r = await api.verifyOtp(email, code);
    if (r.data.token) { setToken(r.data.token); onSignedIn(email); } else setError('Invalid or expired code');
  };

  return (
    <View style={s.screen}>
      <Text testID="sign-in-title" style={s.title}>Sign in to TokenEstate</Text>
      <TextInput testID="email-input" placeholder="E-mail" autoCapitalize="none" value={email} onChangeText={setEmail} style={s.input} />
      <Button id="send-otp-button" label="Send code" onPress={send} />
      {sent && (
        <>
          {delivered && <Text testID="otp-delivered-banner">Code delivered</Text>}
          <TextInput testID="otp-input" placeholder="6-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" style={s.input} />
          <Button id="verify-otp-button" label="Verify" onPress={verify} />
          <Button id="resend-otp-button" label="Resend code" onPress={send} />
        </>
      )}
      {!!error && <Text testID="otp-error-text" style={s.error}>{error}</Text>}
    </View>
  );
}

export function WalletScreen() {
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { api.wallet().then((r) => setBalance(r.data.balance)); }, []);

  const topUp = async () => {
    const r = await api.topUp(Number(amount));
    if (r.status === 200 && r.data.balance !== undefined) { setBalance(r.data.balance); setMsg({ ok: true, text: 'Top-up complete' }); }
    else setMsg({ ok: false, text: 'Payment declined' });
  };
  return (
    <View style={s.screen}>
      <Text style={s.title}>Wallet</Text>
      <Text testID="wallet-balance-text">USD {balance.toFixed(2)}</Text>
      <TextInput testID="topup-amount-input" placeholder="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={s.input} />
      <Button id="topup-submit-button" label="Top up" onPress={topUp} />
      {msg && <Text testID={msg.ok ? 'topup-success-text' : 'topup-error-text'} style={msg.ok ? undefined : s.error}>{msg.text}</Text>}
    </View>
  );
}

export function PropertiesScreen() {
  const [props, setProps] = useState<Property[]>([]);
  const [selected, setSelected] = useState<Property | null>(null);
  useEffect(() => { api.properties().then((r) => setProps(r.data)); }, []);
  if (selected) return <PropertyDetail property={selected} onBack={() => setSelected(null)} />;
  return (
    <FlatList
      testID="property-list"
      data={props}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => (
        <TouchableOpacity testID={`property-card-${item.id}`} onPress={() => setSelected(item)} style={s.card}>
          <Text style={s.title}>{item.name}</Text>
          <Text>{item.city}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

function PropertyDetail({ property, onBack }: { property: Property; onBack: () => void }) {
  const [buying, setBuying] = useState(false);
  const [qty, setQty] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const total = (Number(qty) || 0) * property.pricePerToken;

  const confirm = async () => {
    const r = await api.buy(property.id, Number(qty));
    if (r.status === 200) { invalidatePortfolio(); setMsg({ ok: true, text: 'Purchase complete' }); }
    else setMsg({ ok: false, text: r.data.error === 'insufficient_balance' ? 'Insufficient balance' : 'Order failed' });
  };
  return (
    <View style={s.screen}>
      <Button id="back-button" label="Back" onPress={onBack} />
      <Text testID="property-name-text" style={s.title}>{property.name}</Text>
      <Text testID="property-price-text">USD {property.pricePerToken.toFixed(2)} per token</Text>
      {!buying ? (
        <Button id="buy-tokens-button" label="Buy tokens" onPress={() => setBuying(true)} />
      ) : (
        <>
          <TextInput testID="token-quantity-input" placeholder="Tokens" value={qty} onChangeText={setQty} keyboardType="number-pad" style={s.input} />
          <Text testID="buy-total-text">Total USD {total.toFixed(2)}</Text>
          <Button id="buy-confirm-button" label="Confirm purchase" onPress={confirm} />
        </>
      )}
      {msg && <Text testID={msg.ok ? 'buy-success-text' : 'buy-error-text'} style={msg.ok ? undefined : s.error}>{msg.text}</Text>}
    </View>
  );
}

// SEEDED BUG #2 (see docs/seeded-bugs.md): the portfolio is cached after the first load
// and never refreshed after a purchase, so it shows stale numbers until the app restarts.
let portfolioCache: Portfolio | null = null;
const invalidatePortfolio = () => { /* intentionally does nothing: seeded bug */ };

export function PortfolioScreen() {
  const [data, setData] = useState<Portfolio | null>(portfolioCache);
  useEffect(() => {
    if (portfolioCache) return;
    api.portfolio().then((r) => { portfolioCache = r.data; setData(r.data); });
  }, []);
  if (!data) return <Text>Loading...</Text>;
  return (
    <View style={s.screen}>
      <Text style={s.title}>Portfolio</Text>
      <Text testID="portfolio-total-value-text">USD {data.totalValue.toFixed(2)}</Text>
      {data.holdings.length === 0 && <Text testID="portfolio-empty-text">No holdings yet</Text>}
      {data.holdings.map((h) => (
        <Text key={h.propertyId} testID={`portfolio-holding-row-${h.propertyId}`}>{h.name}: {h.tokens} tokens</Text>
      ))}
    </View>
  );
}

export function ProfileScreen({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <View style={s.screen}>
      <Text style={s.title}>Profile</Text>
      <Text testID="profile-email-text">{email}</Text>
      <Button id="sign-out-button" label="Sign out" onPress={() => { portfolioCache = null; setToken(''); onSignOut(); }} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#bbb', padding: 10, borderRadius: 6 },
  button: { backgroundColor: '#1d4ed8', padding: 12, borderRadius: 6, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  card: { padding: 14, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginBottom: 10 },
  error: { color: '#b91c1c' },
});
