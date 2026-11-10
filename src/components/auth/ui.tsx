import { SymbolView } from 'expo-symbols';
import { useRef, useState, type ComponentProps, type ComponentRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Colors, Radius, Spacing } from '@/constants/theme';

export function SheetHeader({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

// children volitelné kvůli <Trans components={{ strong: <Strong /> }} />.
export function Strong({ children }: { children?: ReactNode }) {
  return <Text style={styles.strong}>{children}</Text>;
}

export function BackButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={styles.back}
      accessibilityLabel={t('common.back')}>
      <SymbolView
        name={{ ios: 'chevron.left', android: 'arrow_back' }}
        size={17}
        weight="semibold"
        tintColor={Colors.text}
      />
    </Pressable>
  );
}

export function Field(props: ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor={Colors.textTertiary} {...props} style={styles.input} />;
}

export function PasswordField(props: ComponentProps<typeof TextInput>) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.passwordWrap}>
      <TextInput
        placeholderTextColor={Colors.textTertiary}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
        style={[styles.input, styles.passwordInput]}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        hitSlop={8}
        style={styles.eye}
        accessibilityLabel={visible ? t('auth.password.hide') : t('auth.password.show')}>
        <SymbolView
          name={
            visible
              ? { ios: 'eye.slash', android: 'visibility_off' }
              : { ios: 'eye', android: 'visibility' }
          }
          size={18}
          tintColor={Colors.textTertiary}
        />
      </Pressable>
    </View>
  );
}

export const passwordRules = [
  { key: 'length', test: (p: string) => p.length >= 8 },
  { key: 'uppercase', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'digit', test: (p: string) => /[0-9]/.test(p) },
] as const;

export const isStrongPassword = (password: string) => passwordRules.every((r) => r.test(password));

// Stejné požadavky jako server (/auth/register a /auth/reset-password).
export function PasswordChecklist({ password }: { password: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.rules}>
      {passwordRules.map((rule) => {
        const met = rule.test(password);
        return (
          <View key={rule.key} style={styles.rule}>
            <SymbolView
              name={
                met
                  ? { ios: 'checkmark.circle.fill', android: 'check_circle' }
                  : { ios: 'circle', android: 'radio_button_unchecked' }
              }
              size={14}
              tintColor={met ? Colors.success : Colors.textTertiary}
            />
            <Text style={[styles.ruleText, met && styles.ruleTextMet]}>
              {t(`app.auth.rules.${rule.key}`)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.primary,
        disabled && styles.primaryDisabled,
        pressed && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={[styles.primaryText, disabled && styles.primaryTextDisabled]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.textButton}>
      <Text style={styles.textButtonLabel}>{label}</Text>
    </Pressable>
  );
}

export function Message({ text, tone }: { text: string | null; tone: 'error' | 'info' }) {
  if (!text) return null;
  return <Text style={tone === 'error' ? styles.error : styles.info}>{text}</Text>;
}

const CODE_LENGTH = 6;

export function CodeInput({
  onComplete,
  disabled,
}: {
  onComplete: (code: string) => void;
  disabled?: boolean;
}) {
  const [code, setCode] = useState('');
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  function change(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (digits.length === CODE_LENGTH) {
      onComplete(digits);
      // Po neplatném kódu se dá rovnou psát znovu.
      setCode('');
    }
  }

  return (
    <View>
      <Pressable style={styles.codeRow} onPress={() => inputRef.current?.focus()}>
        {Array.from({ length: CODE_LENGTH }, (_, i) => (
          <View key={i} style={[styles.codeBox, i === code.length && styles.codeBoxActive]}>
            <Text style={styles.codeDigit}>{code[i] ?? ''}</Text>
          </View>
        ))}
      </Pressable>
      {/* Skryté pole drží klávesnici a automatické vyplnění kódu z e-mailu. */}
      <TextInput
        ref={inputRef}
        value={code}
        onChangeText={change}
        editable={!disabled}
        style={styles.hiddenInput}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        autoFocus
      />
    </View>
  );
}

export function AuthButton({
  variant,
  label,
  icon,
  onPress,
}: {
  variant: 'apple' | 'google' | 'email';
  label: string;
  icon: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.authButton, styles[variant], pressed && styles.pressed]}>
      <View style={styles.authIcon}>{icon}</View>
      <Text style={[styles.authLabel, variant === 'apple' && styles.authLabelLight]}>{label}</Text>
    </Pressable>
  );
}

export function GoogleLogo() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  header: { gap: Spacing.two },
  title: { fontSize: 26, fontWeight: '700', color: Colors.text, letterSpacing: -0.4 },
  subtitle: { fontSize: 16, lineHeight: 22, color: Colors.textSecondary },
  strong: { color: Colors.text, fontWeight: '600' },

  back: {
    alignSelf: 'flex-start',
    marginLeft: -Spacing.two,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },

  input: {
    height: 56,
    paddingHorizontal: Spacing.four,
    fontSize: 17,
    color: Colors.text,
    borderRadius: Radius.medium,
    borderCurve: 'continuous',
    backgroundColor: Colors.background,
  },
  passwordWrap: { justifyContent: 'center' },
  passwordInput: { paddingRight: 48 },
  eye: { position: 'absolute', right: Spacing.four },

  rules: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, marginTop: -Spacing.two },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ruleText: { fontSize: 13, color: Colors.textSecondary },
  ruleTextMet: { color: Colors.success },

  primary: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.medium,
    borderCurve: 'continuous',
    backgroundColor: Colors.primary,
  },
  primaryDisabled: { backgroundColor: Colors.separator },
  primaryText: { fontSize: 17, fontWeight: '600', color: '#fff' },
  primaryTextDisabled: { color: Colors.textTertiary },

  textButton: { alignSelf: 'center', paddingVertical: Spacing.one },
  textButtonLabel: { fontSize: 15, fontWeight: '500', color: Colors.primary },

  error: { fontSize: 14, lineHeight: 20, color: Colors.danger },
  info: { fontSize: 14, lineHeight: 20, color: Colors.success },

  codeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  codeBox: {
    flex: 1,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.small,
    borderCurve: 'continuous',
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  codeBoxActive: { borderColor: Colors.primary, backgroundColor: Colors.surface },
  codeDigit: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },

  authButton: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Radius.medium,
    borderCurve: 'continuous',
  },
  authIcon: { width: 22, alignItems: 'center' },
  authLabel: { fontSize: 17, fontWeight: '600', color: Colors.text },
  authLabelLight: { color: '#fff' },
  apple: { backgroundColor: '#000' },
  google: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.separator },
  email: { backgroundColor: Colors.primarySoft },
});
