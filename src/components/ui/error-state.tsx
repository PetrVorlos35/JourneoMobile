import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/empty-state';
import { ApiError } from '@/lib/api';

// Načtení selhalo: co se stalo a tlačítko „Zkusit znovu“.
export function ErrorState({
  error,
  onRetry,
  title,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const { t } = useTranslation();
  const offline = error instanceof ApiError && error.isNetwork;
  // Zprávy API jsou pro lidi, ostatní chyby (pád kódu) ne.
  const text = error instanceof ApiError ? error.message : t('app.errors.generic');

  return (
    <EmptyState
      icon={
        offline
          ? { ios: 'wifi.slash', android: 'wifi_off' }
          : { ios: 'exclamationmark.triangle', android: 'error' }
      }
      tone={offline ? 'primary' : 'danger'}
      title={title ?? t('app.errors.loadTitle')}
      text={text}
      action={onRetry ? { label: t('app.common.tryAgain'), onPress: onRetry } : undefined}
    />
  );
}
