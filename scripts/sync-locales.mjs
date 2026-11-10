// Zkopíruje překlady z webu (../JourneoV2) do appky. Spouštět po každé změně
// textů na webu: npm run locales:sync. Kopie se commitují, protože EAS build
// web repozitář nemá.
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = resolve(root, process.env.JOURNEO_WEB_DIR ?? '../JourneoV2');

for (const lang of ['cs', 'en']) {
  const from = resolve(webRoot, `src/locales/${lang}/translation.json`);
  if (!existsSync(from)) {
    console.error(`Nenašel jsem ${from}. Nastav JOURNEO_WEB_DIR na složku webu.`);
    process.exit(1);
  }
  copyFileSync(from, resolve(root, `src/locales/web/${lang}.json`));
  console.log(`✓ ${lang}`);
}
