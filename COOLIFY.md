# Nasazení na Coolify

## URL produkce

```
http://qgowo0wk8wc08s8w8c4c8c4s.158.220.118.165.sslip.io
```

## Port

Aplikace naslouchá na **portu 3000** (`PORT=3000`).

V Coolify nastav:
- **Port (internal):** `3000`
- **Health check path:** `/api/health`
- **Build pack:** Dockerfile (nebo Node.js s příkazem `node server.js`)

## Proměnné prostředí

**Není nutné nic nastavovat** — API klíč Eurouter, CORS a limity jsou v `config.js` v repozitáři.

Volitelně můžeš v Coolify přepsat jednotlivé hodnoty přes env (mají přednost před `config.js`):

```env
# EUROUTER_API_KEY=eur_...   # jen pokud chceš jiný klíč než v config.js
# ALLOWED_ORIGINS=...
```

## Widget na webu

Po nasazení vlož na autoaws.cz (nebo testuj na Coolify URL):

```html
<link rel="stylesheet" href="http://qgowo0wk8wc08s8w8c4c8c4s.158.220.118.165.sslip.io/style.css">
<script src="http://qgowo0wk8wc08s8w8c4c8c4s.158.220.118.165.sslip.io/chat.js" data-base-url="http://qgowo0wk8wc08s8w8c4c8c4s.158.220.118.165.sslip.io"></script>
```

Demo stránka s widgetem: stejná URL v kořeni `/`.

## Ověření po deployi

```bash
curl http://qgowo0wk8wc08s8w8c4c8c4s.158.220.118.165.sslip.io/api/health
node tests/qa.test.js http://qgowo0wk8wc08s8w8c4c8c4s.158.220.118.165.sslip.io
```
