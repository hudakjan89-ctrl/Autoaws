# Nasazení — TENESCO Asistent

## Než nasadíš (netechnické, ale blokující)

- [ ] **Souhlas TENESCO** s provozem asistenta na jejich doméně.
- [ ] **Zpracovatelská smlouva (DPA)** — widget uvádí TENESCO jako správce osobních údajů. Bez podpisu to na jejich web nepatří.
- [ ] **Vlastní API klíče** pro tento projekt. Teď jsou sdílené s jiným projektem — sdílená kvóta znamená, že cizí provoz shodí i tohoto asistenta, a únik jednoho klíče položí obojí.
- [ ] **Kdo čte logy a metriky** a co se dělá, když asistent odpoví špatně.

## Volba hostingu

### Doporučeno: dlouho běžící Node proces
Railway, Render, Fly.io nebo VPS. Sessions drží v paměti, vše funguje bez dalších služeb.

```bash
npm ci
NODE_ENV=production node server.js
```

Doporučeno pod procesním manažerem (pm2, systemd) s automatickým restartem.

### Alternativa: Vercel (serverless)
`vercel.json` je připravený. Funguje, ale s výhradou:

Každý požadavek může trefit jinou instanci, takže **serverová session se ztrácí**. Ošetřeno je to takto:
- klient posílá posledních 10 tahů jako `history`,
- server je bere jako **neověřený vstup** (omezená délka, jen role `user`/`assistant`) a použije je pouze při cold startu,
- `session_id` od klienta se zachovává, takže limit 50 zpráv na konverzaci platí i po cold startu.

Rate limit je stále per-instance — při více instancích je reálný limit násobkem `RATE_LIMIT_MAX`. Pokud potřebuješ tvrdý globální limit, nasaď to jako dlouho běžící proces, nebo předřaď Cloudflare.

## Konfigurace

```bash
cp .env.example .env
```

Povinné minimum:

| Proměnná | Hodnota |
|---|---|
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGINS` | `https://www.tenesco.cz,https://tenesco.cz` — **nikdy `*`** |
| aspoň jeden AI klíč | `OPENROUTER_API_KEY` nebo `GROQ_API_KEY` |

Bez hlasových klíčů asistent běží dál — jen textově.

## Stropy nákladů

Drahý je hlas, ne text. Stropy jsou tvrdé: po vyčerpání vrátí server `503` a widget běží dál textově.

| Proměnná | Výchozí | Co dělá |
|---|---|---|
| `TTS_DAILY_CHAR_BUDGET` | 200 000 | znaků syntézy řeči za den |
| `STT_DAILY_REQ_BUDGET` | 2 000 | přepisů řeči za den |
| `RATE_LIMIT_MAX` | 40 | požadavků na IP za minutu |
| `MAX_SESSIONS` | 20 000 | strop sessions v paměti |

Než pustíš provoz, dosaď si do stropů reálné ceny svých tarifů a spočítej denní maximum. Výchozí hodnoty jsou konzervativní, ne spočítané pro tvůj ceník.

## Vložení widgetu na web

Do stránky TENESCO:

```html
<link rel="stylesheet" href="https://TVA-DOMENA/style.css">
<script src="https://TVA-DOMENA/chat.js" data-base-url="https://TVA-DOMENA"></script>
```

Widget potřebuje HTML strukturu z `public/demo.html` (od `<!-- Launcher Button -->` po konec panelu).

`data-base-url` musí být přesně doména uvedená v `ALLOWED_ORIGINS`, jinak požadavky spadnou na CORS.

## Kontrola po nasazení

```bash
curl https://TVA-DOMENA/api/health
```

Vrací počet sekcí báze, počet sessions, latenci, chyby a zbývající rozpočet.

Rychlý test odpovědí:

```bash
node tests/qa.test.js https://TVA-DOMENA
```

## Provoz

- **Logy** jsou strukturované JSON řádky (`evt: "chat"`). Neobsahují text zpráv zákazníků, jen metriky — záměrně, kvůli osobním údajům. Pokud budeš chtít konverzace číst, musí to pokrýt DPA.
- **Sleduj** `chatErrors`, `aiFailures` a `ttsCharsLeft` na `/api/health`.
- **Po změně znalostní báze** restartuj proces — index i whitelist URL se staví při startu.

## Aktualizace znalostní báze

`knowledge/tenesco-kb.md` je jediný zdroj pravdy. Platí:

- fakt, který není ověřený na tenesco.cz, se do báze nepíše — označ ho `UNKNOWN`,
- URL musí být v bázi doslova, jinak asistent odkaz zahodí (whitelist proti halucinacím),
- ceny do báze nepatří, nejsou veřejné.
