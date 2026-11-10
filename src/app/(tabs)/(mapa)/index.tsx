import { useTranslation } from 'react-i18next';

import { ComingSoon } from '@/components/coming-soon';

export default function Screen() {
  const { t } = useTranslation();
  return (
    <ComingSoon
      icon={{ ios: 'map', android: 'map' }}
      title={t('app.comingSoon.mapTitle')}
      text={t('app.comingSoon.mapText')}
    />
  );
}
