import { useTranslation } from 'react-i18next';

import { ComingSoon } from '@/components/coming-soon';

export default function Screen() {
  const { t } = useTranslation();
  return (
    <ComingSoon
      icon={{ ios: 'suitcase', android: 'luggage' }}
      title={t('app.comingSoon.tripsTitle')}
      text={t('app.comingSoon.tripsText')}
    />
  );
}
