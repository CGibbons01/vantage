import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mail, Lock, User, Eye, EyeOff, Chrome } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { COLORS } from '@/constants/theme';
import { AnimatedPressable } from '@/components/AnimatedPressable';

type Mode = 'signup' | 'signin';

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loading, signUpWithEmail, signInWithEmail, signInWithApple, signInWithGoogle } = useAuth();

  const [mode, setMode] = useState<Mode>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submittingEmail, setSubmittingEmail] = useState(false);
  const [submittingApple, setSubmittingApple] = useState(false);
  const [submittingGoogle, setSubmittingGoogle] = useState(false);
  const [error, setError] = useState('');

  const anySubmitting = submittingEmail || submittingApple || submittingGoogle;

  const switchMode = (next: Mode) => {
    console.log('[Auth] Switching mode to:', next);
    setMode(next);
    setError('');
    setName('');
    setEmail('');
    setPassword('');
  };

  const handleCreateAccount = async () => {
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setSubmittingEmail(true);
    console.log('[Auth] Attempting sign-up with email:', email);
    try {
      await signUpWithEmail(email.trim(), password, name.trim());
      console.log('[Auth] Sign-up + auto sign-in complete');
    } catch (e: any) {
      console.error('[Auth] Sign-up error:', e);
      setError(e?.message || 'Account creation failed. Please try again.');
    } finally {
      setSubmittingEmail(false);
    }
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setSubmittingEmail(true);
    console.log('[Auth] Attempting sign-in with email:', email);
    try {
      await signInWithEmail(email.trim(), password);
      console.log('[Auth] Sign-in success — AuthGuard will handle navigation');
    } catch (e: any) {
      console.error('[Auth] Sign-in error:', e);
      setError(e?.message || 'Sign in failed. Please check your credentials.');
    } finally {
      setSubmittingEmail(false);
    }
  };

  const handleApple = async () => {
    setError('');
    setSubmittingApple(true);
    console.log('[Auth] Attempting Apple sign in');
    try {
      await signInWithApple();
      console.log('[Auth] Apple sign-in complete — AuthGuard will handle navigation');
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
      console.log('[Auth] Google sign-in complete — AuthGuard will handle navigation');
    } catch (e: any) {
      console.error('[Auth] Google sign in error:', e);
      if (e?.message !== 'Authentication cancelled') {
        setError(e?.message || 'Google sign in failed.');
      }
    } finally {
      setSubmittingGoogle(false);
    }
  };

  const isSignUp = mode === 'signup';
  const headingTitle = isSignUp ? 'Create Account' : 'Welcome Back';
  const headingSubtitle = isSignUp ? 'Sign up to get started' : 'Sign in to your account';
  const primaryBtnLabel = isSignUp ? 'Create Account' : 'Sign In';
  const primaryBtnAction = isSignUp ? handleCreateAccount : handleSignIn;

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Background glow orbs */}
      <View style={styles.glowOrbTop} />
      <View style={styles.glowOrbBottom} />

      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo / Brand */}
        <View style={styles.brandSection}>
          <View style={styles.logoGlow}>
            <Image
              source={require('../assets/images/app-icon-lca.png')}
              style={styles.logoImage}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.brandTitle}>Vantage AI</Text>
          <Text style={styles.brandSubtitle}>Your AI-powered career companion</Text>
        </View>

        {/* Mode Toggle */}
        <View style={styles.toggleRow}>
          <AnimatedPressable
            style={[styles.toggleBtn, isSignUp && styles.toggleBtnActive]}
            onPress={() => switchMode('signup')}
          >
            {isSignUp ? (
              <LinearGradient
                colors={['#7C3AED', '#4F46E5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.toggleBtnGradient}
              >
                <Text style={[styles.toggleBtnText, styles.toggleBtnTextActive]}>Create Account</Text>
              </LinearGradient>
            ) : (
              <Text style={styles.toggleBtnText}>Create Account</Text>
            )}
          </AnimatedPressable>
          <AnimatedPressable
            style={[styles.toggleBtn, !isSignUp && styles.toggleBtnActive]}
            onPress={() => switchMode('signin')}
          >
            {!isSignUp ? (
              <LinearGradient
                colors={['#7C3AED', '#4F46E5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.toggleBtnGradient}
              >
                <Text style={[styles.toggleBtnText, styles.toggleBtnTextActive]}>Sign In</Text>
              </LinearGradient>
            ) : (
              <Text style={styles.toggleBtnText}>Sign In</Text>
            )}
          </AnimatedPressable>
        </View>

        {/* Heading */}
        <View style={styles.headingSection}>
          <Text style={styles.headingTitle}>{headingTitle}</Text>
          <Text style={styles.headingSubtitle}>{headingSubtitle}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {isSignUp && (
            <View style={styles.inputWrapper}>
              <User size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor={COLORS.textTertiary}
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
              placeholderTextColor={COLORS.textTertiary}
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
              placeholderTextColor={COLORS.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={primaryBtnAction}
            />
            <AnimatedPressable
              onPress={() => {
                console.log('[Auth] Toggle password visibility');
                setShowPassword(!showPassword);
              }}
              style={styles.eyeBtn}
            >
              {showPassword
                ? <EyeOff size={18} color={COLORS.textSecondary} />
                : <Eye size={18} color={COLORS.textSecondary} />
              }
            </AnimatedPressable>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <AnimatedPressable
            style={[styles.primaryBtn, anySubmitting && styles.primaryBtnDisabled]}
            onPress={primaryBtnAction}
            disabled={anySubmitting}
          >
            <LinearGradient
              colors={['#7C3AED', '#4F46E5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryBtnGradient}
            >
              {submittingEmail
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <Text style={styles.primaryBtnText}>{primaryBtnLabel}</Text>
              }
            </LinearGradient>
          </AnimatedPressable>
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social Buttons */}
        <View style={styles.socialButtons}>
          {Platform.OS === 'ios' && (
            <AnimatedPressable
              style={[styles.socialBtn, submittingApple && styles.socialBtnDisabled]}
              onPress={handleApple}
              disabled={anySubmitting}
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
            </AnimatedPressable>
          )}

          <AnimatedPressable
            style={[styles.socialBtn, submittingGoogle && styles.socialBtnDisabled]}
            onPress={handleGoogle}
            disabled={anySubmitting}
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
          </AnimatedPressable>
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
  glowOrbTop: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
  },
  glowOrbBottom: {
    position: 'absolute',
    bottom: 0,
    left: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(236, 72, 153, 0.08)',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoGlow: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
    marginBottom: 16,
  },
  logoImage: {
    width: 72,
    height: 72,
    borderRadius: 18,
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
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 4,
    marginBottom: 28,
  },
  toggleBtn: {
    flex: 1,
    height: 40,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  toggleBtnActive: {},
  toggleBtnGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 9,
  },
  toggleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  toggleBtnTextActive: {
    color: '#FFFFFF',
  },
  headingSection: {
    marginBottom: 24,
  },
  headingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  headingSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  form: {
    gap: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSecondary,
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
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
  },
  primaryBtnGradient: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
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
    backgroundColor: COLORS.surfaceSecondary,
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
