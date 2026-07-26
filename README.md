# Auto AWS Asistent

Chatbot a demo web pro [autoaws.cz](https://autoaws.cz/) — prodej koncernových automobilů v Uherském Brodě.

## Spuštění

```bash
npm ci
npm start
```

Konfigurace (včetně Eurouter API klíče) je v `config.js` — není potřeba nic doplňovat.

Otevři http://localhost:3000 — demo stránka s chat widgetem.

## Stack

- **Backend:** Node.js + Express
- **AI:** Eurouter API (`claude-sonnet-5`)
- **Znalostní báze:** `knowledge/autoaws-kb.md`
- **Frontend:** `public/demo.html`, `public/chat.js`, `public/style.css`

## Testy

```bash
node tests/qa.test.js http://localhost:3000
```
