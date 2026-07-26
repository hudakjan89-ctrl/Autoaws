# Auto AWS Asistent

Chatbot a demo web pro [autoaws.cz](https://autoaws.cz/) — prodej koncernových automobilů v Uherském Brodě.

## Spuštění

```bash
npm ci
cp .env.example .env   # vyplň EUROUTER_API_KEY
npm start
```

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
