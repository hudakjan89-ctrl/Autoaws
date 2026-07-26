# Scénáře chatbota Auto AWS

Chatbot má **2 hlavní scénáře** s přirozeným průběhem — ptá se **více věcí najednou v jedné zprávě**, přesměrování ukáže **až na konci**.

---

## Scénář 1: Výběr auta

**Spuštění:** „Hledám auto", „Chci vybrat vůz", „Co doporučíte?"

### Krok 1 — bot se zeptá najednou (1 zpráva)

```
Rád pomůžu s výběrem! Abych našel vhodný vůz, napište mi prosím do jedné zprávy:
• orientační rozpočet / cenu (např. do 500 tisíc)
• palivo (benzín, diesel, elektro)
• převodovku (manuál / automat)
• typ auta (do města, kombi, SUV…)
• značku, pokud vám na ní záleží
• případně max. nájezd v km
• případně ročník nebo stáří vozu

Stačí stručně — třeba: „do 500 tisíc, diesel, automat, kombi, max. 150 tisíc km".
```

→ **Žádné přesměrování** — jen text v chatu.

### Krok 2 — uživatel odpoví jednou větou

**Uživatel:** `do 500 tisíc, elektro, automat, do města, VW, max 100 tisíc km`

**Bot:** doporučí konkrétní vůz + cenu + odkaz → **teprve teď** karta Ano/Ne na inzerát.

### Příklad finále

```
Na základě vašich požadavků bych doporučil:

**Volkswagen e-up! 61kW Style** — 379 000 Kč s DPH.
Nejlevnější elektromobil v nabídce — ideální do města.

Chcete probrat financování k tomuto vozu, nebo si domluvit prohlídku?
```

---

## Scénář 2: Financování (vždy k konkrétnímu autu)

**Spuštění:** „Zajímá mě financování", „Dá se to na splátky?", „Kolik by byla splátka?"

### Varianta A — uživatel ještě neřekl, jaké auto

**Krok 1 — bot se zeptá najednou:**
```
Financování vyřídíme přímo u nás přes Moneta Auto. Napište mi prosím do jedné zprávy:
• konkrétní auto z naší nabídky (např. Passat, e-up!, Cupra Born…)
• zda plánujete akontaci, nebo financovat co nejvíc z ceny
• zda preferujete nižší splátku, nebo rychlejší splacení

Příklad: „Passat, bez akontace, nižší splátka".
```

**Krok 2 — uživatel:** `Passat, bez akontace, nižší splátka`

**Bot:** shrnutí **k Passatu za 447 000 Kč** + Moneta Auto + odkaz na /financovani/

### Varianta B — uživatel právě vybral auto (scénář 1)

**Uživatel:** `Dá se to financovat?`

**Bot** (už zná vůz z konverzace):
```
Ano, vůz Volkswagen e-up! (379 000 Kč s DPH) u nás financovat jde — přes Moneta Auto,
až 100 % ceny, splácení až 84 měsíců…

Napište prosím: akontaci? nižší splátku nebo rychlejší splacení?
```

**Uživatel:** `bez akontace, nižší splátka` → finální výpočet k **tomu samému vozu**.

---

## Propojení scénářů

```
Výběr auta  →  doporučení vozu  →  „Dá se financovat?"  →  financování k tomu vozu
```

Auto se pamatuje v session (`selectedCar`) — financování vždy sedí na konkrétní vůz a jeho cenu.

---

## Katalog vozů

| Vůz | Cena | Palivo | Typ |
|-----|------|--------|-----|
| VW e-up! | 379 000 Kč | elektro | městské |
| VW Passat 2.0 TDi | 447 000 Kč | diesel | kombi |
| Cupra Born | 569 000 Kč | elektro | kompaktní |
| Seat Ateca FR Line | 614 000 Kč | benzín | SUV |
