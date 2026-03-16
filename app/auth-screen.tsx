import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Briefcase, Mail, Lock, User, Eye, EyeOff, Chrome } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { COLORS } from '@/constants/theme';
import { isOnboardingComplete } from '@/utils/onboardingStorage';

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { user, loading, signInWithEmail, signUpWithEmail, signInWithApple, signInWithGoogle } = useAuth();

  const initialMode = params.mode === 'signup' ? 'signup' : 'signin';
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submittingEmail, setSubmittingEmail] = useState(false);
  const [submittingApple, setSubmittingApple] = useState(false);
  const [submittingGoogle, setSubmittingGoogle] = useState(false);
  const [error, setError] = useState('');

  const anySubmitting = submittingEmail || submittingApple || submittingGoogle;

  useEffect(() => {
    if (user) {
      console.log('[Auth] User authenticated, checking onboarding status');
      handlePostAuthNavigation();
    }
  }, [user]);

  const handlePostAuthNavigation = async () => {
    try {
      const onboardingDone = await isOnboardingComplete();
      console.log('[Auth] Onboarding complete:', onboardingDone);
      if (onboardingDone) {
        console.log('[Auth] Routing to tabs (onboarding already done)');
        router.replace('/(tabs)');
      } else {
        console.log('[Auth] Routing to paywall (new user)');
        router.replace('/paywall');
      }
    } catch (e) {
      console.error('[Auth] Error checking onboarding status:', e);
      router.replace('/paywall');
    }
  };

  const switchMode = (next: 'signin' | 'signup') => {
    console.log(`[Auth] Switching mode to ${next}`);
    setMode(next);
    setName('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setError('');
  };

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Please enter your name.');
      return;
    }
    setError('');
    setSubmittingEmail(true);
    console.log(`[Auth] Attempting ${mode} with email: ${email}`);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email.trim(), password);
      } else {
        await signUpWithEmail(email.trim(), password, name.trim());
      }
    } catch (e: any) {
      console.error('[Auth] Email auth error:', e);
      setError(e?.message || 'Authentication failed. Please try again.');
    } finally {
      setSubmittingEmail(false);
    }
  };

  const handleForgotPassword = () => {
    console.log('[Auth] Forgot password pressed');
    Alert.alert(
      'Reset Password',
      'Please contact support at support@vantageai.com to reset your password.',
      [{ text: 'OK' }]
    );
  };

  const handleApple = async () => {
    setError('');
    setSubmittingApple(true);
    console.log('[Auth] Attempting Apple sign in');
    try {
      await signInWithApple();
    } catch (e: any) {
      console.error('[Auth] Apple sign in error:', e);
      if (e?.message !== 'Authentication cancelled') {
        setError(e?.message || 'Apple sign in failed.');
      }
    } finally {
      setSubmittingApple(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setSubmittingGoogle(true);
    console.log('[Auth] Attempting Google sign in');
    try {
      await signInWithGoogle();
    } catch (e: any) {
      console.error('[Auth] Google sign in error:', e);
      if (e?.message !== 'Authentication cancelled') {
        setError(e?.message || 'Google sign in failed.');
      }
    } finally {
      setSubmittingGoogle(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  const primaryBtnLabel = mode === 'signin' ? 'Sign In' : 'Create Account';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo / Brand */}
        <View style={styles.brandSection}>
          <Image
            source={require('../assets/images/app-icon-lca.png')}
            style={styles.logoImage}
            resizeMode="cover"
          />
          <Text style={styles.brandTitle}>Vantage AI</Text>
          <Text style={styles.brandSubtitle}>Your AI-powered career companion</Text>
        </View>

        {/* Mode Toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'signin' && styles.modeBtnActive]}
            onPress={() => switchMode('signin')}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeBtnText, mode === 'signin' && styles.modeBtnTextActive]}>
              Sign In
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'signup' && styles.modeBtnActive]}
            onPress={() => switchMode('signup')}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeBtnText, mode === 'signup' && styles.modeBtnTextActive]}>
              Create Account
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {mode === 'signup' && (
            <View style={styles.inputWrapper}>
              <User size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor={COLORS.textMuted}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
          )}

          <View style={styles.inputWrapper}>
            <Mail size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor={COLORS.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Lock size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Password"
              placeholderTextColor={COLORS.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleEmailAuth}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              {showPassword
                ? <EyeOff size={18} color={COLORS.textSecondary} />
                : <Eye size={18} color={COLORS.textSecondary} />
              }
            </TouchableOpacity>
          </View>

          {mode === 'signin' && (
            <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotBtn} activeOpacity={0.7}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryBtn, (submittingEmail || anySubmitting) && styles.primaryBtnDisabled]}
            onPress={handleEmailAuth}
            disabled={anySubmitting}
            activeOpacity={0.85}
          >
            {submittingEmail
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={styles.primaryBtnText}>{primaryBtnLabel}</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social Buttons */}
        <View style={styles.socialButtons}>
          {/* Apple first — App Store requirement */}
          <TouchableOpacity
            style={[styles.socialBtn, submittingApple && styles.socialBtnDisabled]}
            onPress={handleApple}
            disabled={anySubmitting}
            activeOpacity={0.85}
          >
            {submittingApple
              ? <ActivityIndicator color={COLORS.text} size="small" />
              : (
                <>
                  <Text style={styles.appleIcon}></Text>
                  <Text style={styles.socialBtnText}>Continue with Apple</Text>
                </>
              )
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialBtn, submittingGoogle && styles.socialBtnDisabled]}
            onPress={handleGoogle}
            disabled={anySubmitting}
            activeOpacity={0.85}
          >
            {submittingGoogle
              ? <ActivityIndicator color={COLORS.text} size="small" />
              : (
                <>
                  <Chrome size={20} color={COLORS.text} />
                  <Text style={styles.socialBtnText}>Continue with Google</Text>
                </>
              )
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    backgroundColor: COLORS.background,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoImage: {
    width: 70,
    height: 70,
    borderRadius: 16,
    marginBottom: 16,
  },
  brandTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: COLORS.accent,
  },
  modeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  modeBtnTextActive: {
    color: '#000',
  },
  form: {
    gap: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  eyeBtn: {
    padding: 4,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.accent,
  },
  errorBox: {
    backgroundColor: COLORS.errorMuted,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
    fontWeight: '500',
  },
  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  socialButtons: {
    gap: 12,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    height: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  socialBtnDisabled: {
    opacity: 0.6,
  },
  appleIcon: {
    fontSize: 20,
    color: COLORS.text,
    lineHeight: 24,
  },
  socialBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
});
