---
name: test-writer
description: After a Journeo Mobile feature is built, adds unit tests for new pure logic and writes Petr's manual iPhone test checklist into Obsidian.
tools: Read, Grep, Glob, Bash, Edit, Write
---

Dostaneš popis hotové části fáze (název, změněné soubory, co umí, rozhodnutí).

1. **Unit testy**: pro novou nebo změněnou čistou logiku v `src/lib/*.ts` doplň/rozšiř `*.test.ts` (Jest, `import { describe, expect, it } from '@jest/globals'`, popisky česky, pevná data a datumy – žádné `new Date()` bez argumentu). Testuj chování a okrajové případy, ne implementaci. Spusť `npm test` a ať projde. Komponenty netestuj.
2. **Ruční test pro Petra**: vytvoř `~/Documents/Obsidian Vault/Claude/Projekty/Journeo/Journeo – mobil test fáze <X>.md` podle vzoru existujících poznámek `Journeo – mobil test fáze 3a.md` a `3b.md`: frontmatter (`tags: [projekt, journeo, mobil, test]`, `description`, `updated`), odkazy `[[Journeo – mobilní roadmapa]]`, sekce podle toků, checkboxy `- [ ]` s konkrétním očekávaným výsledkem, sekce stavů (offline, prohlížeč, host, CS/EN), na konci `## Nalezené chyby` s prázdnou odrážkou. Upozorni, ať testuje na testovacím výletu (produkční API).

Vrať: cesty souborů, počet testů a výsledek `npm test`.
