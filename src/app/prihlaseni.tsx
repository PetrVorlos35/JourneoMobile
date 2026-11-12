import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, View } from 'react-native';

import {
  AuthButton,
  BackButton,
  CodeInput,
  Field,
  GoogleLogo,
  isStrongPassword,
  Message,
  PasswordChecklist,
  PasswordField,
  PrimaryButton,
  SheetHeader,
  Strong,
  TextButton,
} from '@/components/auth/ui';
import { Colors, Spacing } from '@/constants/theme';
import { ApiError, authApi, type User } from '@/lib/api';
import i18n from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { reportError } from '@/lib/telemetry';
import { ownTrips } from '@/lib/trip';
import { useTrips } from '@/lib/trips';

// Stejné kroky jako AuthFlow na webu:
// e-mail → heslo (účet existuje) | nové heslo → kód z e-mailu → jméno.
// Z hesla se dá odbočit na zapomenuté heslo → kód → nové heslo.
type Step =
  'choose' | 'email' | 'password' | 'create' | 'otp' | 'profile' | 'resetCode' | 'resetPassword';

// Zprávy API (zatím jen česky ze serveru) ukážeme, chybu v kódu nahlásíme.
function errorText(err: unknown) {
  if (err instanceof ApiError) return err.message;
  reportError(err);
  return i18n.t('app.errors.generic');
}

export default function SignInSheet() {
  const { t } = useTranslation();
  const { isGuest, plannedDestination, completeAuth } = useSession();
  const { trips } = useTrips();
  // Host má jeden vlastní výlet; dokud ho nezaloží, stačí destinace z úvodu.
  const guestTrip = ownTrips(trips ?? [])[0]?.title ?? plannedDestination;
  const [step, setStep] = useState<Step>('choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Po ověření e-mailu držíme přihlášení, dokud uživatel nedokončí jméno.
  const [verified, setVerified] = useState<{ token: string; user: User } | null>(null);

  const cleanEmail = email.trim().toLowerCase();

  function go(next: Step) {
    setError(null);
    setInfo(null);
    setStep(next);
  }

  async function run(action: () => Promise<void>) {
    setPending(true);
    setError(null);
    setInfo(null);
    try {
      await action();
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  async function finish(token: string, user: User) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
    await completeAuth(token, user);
  }

  const submitEmail = () =>
    run(async () => {
      const { exists } = await authApi.checkEmail(cleanEmail);
      setPassword('');
      go(exists ? 'password' : 'create');
    });

  const submitLogin = () =>
    run(async () => {
      try {
        const { token, user } = await authApi.login(cleanEmail, password);
        await finish(token, user);
      } catch (err) {
        // Účet založený, ale neověřený: pošleme nový kód a pokračujeme ověřením.
        if (err instanceof ApiError && err.data.needsVerification) {
          await authApi.resendOtp(cleanEmail);
          go('otp');
          return;
        }
        throw err;
      }
    });

  const submitRegister = () =>
    run(async () => {
      await authApi.register(cleanEmail, password);
      go('otp');
    });

  const submitCode = (code: string) =>
    run(async () => {
      const result = await authApi.verify(cleanEmail, code);
      setVerified(result);
      go('profile');
    });

  const resendCode = () =>
    run(async () => {
      await authApi.resendOtp(cleanEmail);
      setInfo(t('app.auth.otp.resent'));
    });

  const submitProfile = (skip: boolean) =>
    run(async () => {
      if (!verified) return;
      let user = verified.user;
      if (!skip && (firstName.trim() || lastName.trim())) {
        ({ user } = await authApi.updateProfile(
          { first_name: firstName.trim() || null, last_name: lastName.trim() || null },
          verified.token,
        ));
      }
      await finish(verified.token, user);
    });

  const startReset = () =>
    run(async () => {
      await authApi.forgotPassword(cleanEmail);
      setPassword('');
      go('resetCode');
    });

  const resendResetCode = () =>
    run(async () => {
      await authApi.forgotPassword(cleanEmail);
      setInfo(t('app.auth.otp.resent'));
    });

  // Kód se ověří hned, nové heslo jde zadat až po správném kódu.
  const submitResetCode = (code: string) =>
    run(async () => {
      await authApi.verifyResetCode(cleanEmail, code);
      setResetCode(code);
      go('resetPassword');
    });

  // Kód mohl mezitím vypršet: pak zpátky na jeho zadání.
  const submitReset = () =>
    run(async () => {
      try {
        await authApi.resetPassword(cleanEmail, resetCode, password);
        setPassword('');
        setResetCode('');
        go('password');
        setInfo(t('app.auth.password.changed'));
      } catch (err) {
        if (err instanceof ApiError && err.status === 400 && /kód/i.test(err.message)) {
          setResetCode('');
          setStep('resetCode');
        }
        throw err;
      }
    });

  if (step === 'email') {
    const valid = /^\S+@\S+\.\S+$/.test(cleanEmail);
    return (
      <View style={[styles.sheet, styles.sheetWithBack]}>
        <BackButton onPress={() => go('choose')} />
        <SheetHeader title={t('app.auth.email.title')} subtitle={t('app.auth.email.subtitle')} />
        <Field
          value={email}
          onChangeText={setEmail}
          placeholder={t('app.auth.email.placeholder')}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          returnKeyType="next"
          onSubmitEditing={() => valid && submitEmail()}
        />
        <Message text={error} tone="error" />
        <PrimaryButton
          label={t('app.common.continue')}
          onPress={submitEmail}
          disabled={!valid}
          loading={pending}
        />
      </View>
    );
  }

  if (step === 'password') {
    return (
      <View style={[styles.sheet, styles.sheetWithBack]}>
        <BackButton onPress={() => go('email')} />
        <SheetHeader
          title={t('app.auth.password.title')}
          subtitle={<Strong>{cleanEmail}</Strong>}
        />
        <PasswordField
          value={password}
          onChangeText={setPassword}
          placeholder={t('app.auth.password.placeholder')}
          autoFocus
          textContentType="password"
          autoComplete="current-password"
          returnKeyType="go"
          onSubmitEditing={() => password && submitLogin()}
        />
        <Message text={error} tone="error" />
        <Message text={info} tone="info" />
        <PrimaryButton
          label={t('app.auth.password.submit')}
          onPress={submitLogin}
          disabled={!password}
          loading={pending}
        />
        <TextButton label={t('app.auth.password.forgot')} onPress={startReset} />
      </View>
    );
  }

  if (step === 'create') {
    const strong = isStrongPassword(password);
    return (
      <View style={[styles.sheet, styles.sheetWithBack]}>
        <BackButton onPress={() => go('email')} />
        <SheetHeader
          title={t('app.auth.create.title')}
          subtitle={<EmailNote i18nKey="app.auth.create.subtitle" email={cleanEmail} />}
        />
        <PasswordField
          value={password}
          onChangeText={setPassword}
          placeholder={t('app.auth.password.placeholder')}
          autoFocus
          textContentType="newPassword"
          autoComplete="new-password"
          returnKeyType="go"
          onSubmitEditing={() => strong && submitRegister()}
        />
        <PasswordChecklist password={password} />
        <Message text={error} tone="error" />
        <PrimaryButton
          label={t('app.auth.create.submit')}
          onPress={submitRegister}
          disabled={!strong}
          loading={pending}
        />
      </View>
    );
  }

  if (step === 'otp') {
    return (
      <View style={[styles.sheet, styles.sheetWithBack]}>
        <BackButton onPress={() => go('email')} />
        <SheetHeader
          title={t('app.auth.otp.title')}
          subtitle={<EmailNote i18nKey="app.auth.otp.sent" email={cleanEmail} />}
        />
        <CodeInput onComplete={submitCode} disabled={pending} />
        <Message text={error} tone="error" />
        <Message text={info} tone="info" />
        <TextButton label={t('app.auth.otp.resend')} onPress={resendCode} />
      </View>
    );
  }

  if (step === 'profile') {
    return (
      <View style={styles.sheet}>
        <SheetHeader
          title={t('app.auth.profile.title')}
          subtitle={t('app.auth.profile.subtitle')}
        />
        <Field
          value={firstName}
          onChangeText={setFirstName}
          placeholder={t('auth.fields.firstName')}
          autoFocus
          textContentType="givenName"
          autoComplete="given-name"
          returnKeyType="next"
        />
        <Field
          value={lastName}
          onChangeText={setLastName}
          placeholder={t('auth.fields.lastName')}
          textContentType="familyName"
          autoComplete="family-name"
          returnKeyType="done"
          onSubmitEditing={() => submitProfile(false)}
        />
        <Message text={error} tone="error" />
        <PrimaryButton
          label={t('app.common.done')}
          onPress={() => submitProfile(false)}
          loading={pending}
        />
        <TextButton label={t('app.common.skip')} onPress={() => submitProfile(true)} />
      </View>
    );
  }

  if (step === 'resetCode') {
    return (
      <View style={[styles.sheet, styles.sheetWithBack]}>
        <BackButton onPress={() => go('password')} />
        <SheetHeader
          title={t('app.auth.reset.title')}
          subtitle={<EmailNote i18nKey="app.auth.otp.sent" email={cleanEmail} />}
        />
        <CodeInput onComplete={submitResetCode} disabled={pending} />
        <Message text={error} tone="error" />
        <Message text={info} tone="info" />
        <TextButton label={t('app.auth.otp.resend')} onPress={resendResetCode} />
      </View>
    );
  }

  if (step === 'resetPassword') {
    const valid = isStrongPassword(password);
    return (
      <View style={[styles.sheet, styles.sheetWithBack]}>
        <BackButton onPress={() => go('resetCode')} />
        <SheetHeader
          title={t('app.auth.reset.newTitle')}
          subtitle={t('app.auth.reset.newSubtitle')}
        />
        <PasswordField
          value={password}
          onChangeText={setPassword}
          placeholder={t('app.auth.reset.placeholder')}
          autoFocus
          textContentType="newPassword"
          autoComplete="new-password"
          returnKeyType="go"
          onSubmitEditing={() => valid && submitReset()}
        />
        <PasswordChecklist password={password} />
        <Message text={error} tone="error" />
        <PrimaryButton
          label={t('app.auth.reset.submit')}
          onPress={submitReset}
          disabled={!valid}
          loading={pending}
        />
      </View>
    );
  }

  return (
    <View style={styles.sheet}>
      <SheetHeader
        title={isGuest ? t('app.auth.choose.guestTitle') : t('app.auth.choose.title')}
        subtitle={
          !isGuest
            ? t('app.auth.choose.subtitle')
            : guestTrip
              ? t('app.auth.choose.guestSubtitleTrip', { trip: guestTrip })
              : t('app.auth.choose.guestSubtitle')
        }
      />

      <View style={styles.buttons}>
        {Platform.OS === 'ios' && (
          <AuthButton
            variant="apple"
            label={t('app.auth.choose.apple')}
            icon={<SymbolView name="apple.logo" size={19} tintColor="#fff" />}
            onPress={() => setInfo(t('app.auth.choose.appleSoon'))}
          />
        )}
        <AuthButton
          variant="google"
          label={t('app.auth.choose.google')}
          icon={<GoogleLogo />}
          onPress={() => setInfo(t('app.auth.choose.googleSoon'))}
        />
        <AuthButton
          variant="email"
          label={t('app.auth.choose.email')}
          icon={
            <SymbolView
              name={{ ios: 'envelope.fill', android: 'mail' }}
              size={17}
              tintColor={Colors.primary}
            />
          }
          onPress={() => go('email')}
        />
      </View>

      {info ? (
        <Text style={styles.notice}>{info}</Text>
      ) : (
        <Text style={styles.legal}>
          <Trans
            i18nKey="app.auth.choose.legal"
            components={{
              terms: <Text style={styles.legalLink} />,
              privacy: <Text style={styles.legalLink} />,
            }}
          />
        </Text>
      )}
    </View>
  );
}

// „Poslali jsme kód na <strong>{{email}}</strong>.“ s tučným e-mailem.
function EmailNote({
  i18nKey,
  email,
}: {
  i18nKey: 'app.auth.create.subtitle' | 'app.auth.otp.sent';
  email: string;
}) {
  return <Trans i18nKey={i18nKey} values={{ email }} components={{ strong: <Strong /> }} />;
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: Spacing.six,
    paddingTop: Spacing.eight,
    paddingBottom: Spacing.eight,
    gap: Spacing.five,
    backgroundColor: Colors.surface,
  },
  // Na vlastním řádku nad nadpisem, ať se s ním nepřekrývá.
  sheetWithBack: { paddingTop: Spacing.five, gap: Spacing.four },
  buttons: { gap: Spacing.three },
  legal: { fontSize: 12, lineHeight: 17, color: Colors.textTertiary, textAlign: 'center' },
  legalLink: { color: Colors.textSecondary, textDecorationLine: 'underline' },
  notice: { fontSize: 14, lineHeight: 20, color: Colors.textSecondary, textAlign: 'center' },
});
