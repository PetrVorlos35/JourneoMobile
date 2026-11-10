import { useTranslation } from 'react-i18next';

import { TabStack } from '@/components/tab-stack';

export default function Layout() {
  const { t } = useTranslation();
  return <TabStack title={t('app.tabs.profile')} />;
}
