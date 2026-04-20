import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { saveUser } from '../utils/storage';
import { COLORS, FONTS, RADIUS, SHADOWS } from '../utils/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RegisterScreen({ navigation, onLogin }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password || !confirm) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const user = {
        id: Date.now().toString(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        joinedAt: new Date().toISOString(),
      };
      const saved = await saveUser(user);
      await AsyncStorage.setItem('currentUser', JSON.stringify(saved));
      onLogin(saved);
    } catch (e) {
      Alert.alert('Registration failed', e.message);
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <View style={styles.logoRow}>
              <Text style={styles.logoIcon}>🌿</Text>
              <Text style={styles.appName}>AgriChat</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>
              Join thousands of Tamil Nadu farmers
            </Text>

            {[
              {
                label: 'Full name',
                value: name,
                setter: setName,
                placeholder: 'Your full name',
                type: 'default',
              },
              {
                label: 'Email address',
                value: email,
                setter: setEmail,
                placeholder: 'you@example.com',
                type: 'email-address',
              },
              {
                label: 'Password',
                value: password,
                setter: setPassword,
                placeholder: 'Min 6 characters',
                secure: true,
              },
              {
                label: 'Confirm password',
                value: confirm,
                setter: setConfirm,
                placeholder: 'Re-enter password',
                secure: true,
              },
            ].map((field, i) => (
              <View key={i} style={styles.inputGroup}>
                <Text style={styles.label}>{field.label}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={field.placeholder}
                  placeholderTextColor={COLORS.textMuted}
                  value={field.value}
                  onChangeText={field.setter}
                  keyboardType={field.type || 'default'}
                  autoCapitalize={field.type === 'email-address' ? 'none' : 'words'}
                  autoCorrect={false}
                  secureTextEntry={!!field.secure}
                />
              </View>
            ))}

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.loginLink}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.benefits}>
            {[
              '🌾 KCC Agricultural Knowledge Base',
              '🔍 Real-time web search fallback',
              '📸 Crop disease image analysis',
              '🗣️ Tamil, Tanglish & English support',
            ].map((item, i) => (
              <View key={i} style={styles.benefitItem}>
                <Text style={styles.benefitText}>{item}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 24 },
  header: { marginBottom: 24 },
  backBtn: { marginBottom: 16 },
  backText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoIcon: { fontSize: 28 },
  appName: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: 28,
    ...SHADOWS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 20,
  },
  title: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginBottom: 24,
  },
  inputGroup: { marginBottom: 14 },
  label: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
  },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    ...SHADOWS.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: '#fff',
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
  },
  loginText: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted },
  loginLink: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: '700',
  },
  benefits: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.lg,
    padding: 16,
    gap: 8,
  },
  benefitItem: { paddingVertical: 2 },
  benefitText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primaryDark,
    lineHeight: 20,
  },
});