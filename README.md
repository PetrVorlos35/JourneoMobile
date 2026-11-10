# Journeo – mobilní aplikace

Nativní aplikace [Journeo](https://journeo.vorlos.eu) pro iOS a Android. Celý výlet v jedné appce: itinerář, mapa, výdaje a vyrovnání mezi parťáky, seznam věcí a připravenost na cestu.

Postavené na [Expo](https://expo.dev) (React Native) a Expo Router. Appka používá stejné Express API jako webová verze.

> Ve vývoji. Hotový je základ (API klient, překlady, společné komponenty, telemetrie) a přihlášení. Další funkce se postupně převádějí z webu.

## Technologie

- **Expo SDK 58**, React Native 0.88, React 19, TypeScript
- **Expo Router** – navigace podle souborů v `src/app/`, nativní taby a stacky
- **iOS-first design** podle Apple HIG: SF Symbols (`expo-symbols`), `@expo/ui`, Liquid Glass, haptika
- **i18next** – čeština a angličtina, jazyk podle telefonu
- **expo-secure-store** – JWT token
- **date-fns** – formátování dat

## Spuštění

Potřeba: Node.js 20+ a na telefonu [Expo Go](https://expo.dev/go) (nebo vlastní development build).

```bash
npm install
cp .env.example .env.local   # a doplň adresu API
npm start
```

Naskenuj QR kód z terminálu v Expo Go. Telefon musí být ve stejné Wi-Fi jako počítač.

### Proměnné prostředí

| Proměnná | Popis |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Adresa Journeo API včetně `/api`. Pro Expo Go na telefonu použij IP počítače v síti, ne `localhost`. |
| `EXPO_PUBLIC_TELEMETRY` | `1` zapne odesílání analytiky a chyb i při vývoji (jinak je vypnuté). |

Proměnné s prefixem `EXPO_PUBLIC_` se zabalí přímo do appky, takže do nich nepatří žádná tajemství.

## Skripty

| Příkaz | Co dělá |
| --- | --- |
| `npm start` | Spustí Metro bundler |
| `npm run ios` / `npm run android` | Spustí a otevře na iOS / Androidu |
| `npm run lint` | ESLint (`expo lint`) |
| `npx tsc --noEmit` | Kontrola typů |
| `npm run locales:sync` | Zkopíruje překlady z webu (`../JourneoV2`, jinak nastav `JOURNEO_WEB_DIR`) |

Nové balíčky instaluj přes `npx expo install <balíček>`, ať sedí verze k SDK.

## Struktura

```
src/
├── app/               # obrazovky (Expo Router)
│   ├── (tabs)/        # spodní taby: Přehled, Výlety, Mapa, Profil
│   ├── (uvod)/        # úvod při prvním spuštění, „Kam jedeš?“
│   └── prihlaseni.tsx # přihlášení / registrace (sheet)
├── components/        # sdílené komponenty, ui/ = skeleton, prázdný a chybový stav, toast
├── constants/         # téma (barvy, typografie)
├── lib/               # API klient, session, i18n, formátování, telemetrie
├── locales/           # texty appky (cs, en) + web/ = kopie překladů z webu
└── types/
scripts/
└── sync-locales.mjs   # synchronizace překladů z webu
```

### Překlady

- Texty sdílené s webem jsou v `src/locales/web/`. Needitují se ručně, přepisuje je `npm run locales:sync`. Kopie se commitují, protože EAS build nemá přístup k repozitáři webu.
- Texty jen pro mobil jsou v `src/locales/{cs,en}.json` pod klíčem `app.*`.
- Klíče hlídá TypeScript (`src/types/i18next.d.ts`).

## Build a vydání

Buildy běží v cloudu přes [EAS](https://docs.expo.dev/eas/), Xcode ani Android Studio nejsou potřeba:

```bash
npx eas-cli@latest build --profile development   # development build (nativní moduly mimo Expo Go)
npx eas-cli@latest build --platform ios          # produkční build
npx eas-cli@latest submit
```

Složky `ios/` a `android/` se generují automaticky (Continuous Native Generation) a nejsou v repozitáři. Nativní nastavení patří do `app.json` a config pluginů.

## Konvence

- Načítání obsahu = skeletony, ne spinnery (spinner jen v tlačítku).
- Každá funkce má stav načítání, prázdný stav, chybový stav (offline / chyba serveru) a texty v CS i EN.
- Pravidla pro AI asistenty jsou v [`AGENTS.md`](AGENTS.md).
