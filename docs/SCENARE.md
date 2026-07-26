# Scénáře chatbota Auto AWS

Kompletní průvodce chováním asistenta. Logika běží v `scenarios.js`, testy v `tests/scenarios.test.js` a `tests/scenarios-full.test.js`.

**Ověřeno:** 9/9 scénářových testů + 18/18 FAQ testů (lokálně).

---

## Obecná pravidla

| Pravidlo | Chování |
|----------|---------|
| Doptávání | Bot se ptá **více věcí najednou v jedné přátelské zprávě** |
| Přesměrování | Karta **Ano / Ne** se zobrazí **až po finální odpovědi** (ne během doptávání) |
| Financování | Vždy k **konkrétnímu autu** z nabídky — bot si pamatuje vůz z konverzace |
| FAQ | Jednoduché dotazy („Nabízíte financování?") → okamžitá odpověď bez scénáře |

---

# SCÉNÁŘ 1: Výběr auta

## Spouštěcí fráze

- „Hledám auto"
- „Chci auto / vůz"
- „Potřebuji vybrat auto"
- „Co doporučíte?"
- „Hledám auto do 500 tisíc"

## Krok 1 — bot se zeptá najednou

**Uživatel:** `Hledám auto`

**Bot:**
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

→ Žádná karta přesměrování.

## Krok 2 — uživatel odpoví jednou větou

**Uživatel:** `do 500 tisíc, elektro, automat, do města, VW, max 100 tisíc km`

**Bot:**
```
Na základě vašich požadavků bych doporučil:

Volkswagen e-up! 61kW Style — 379 000 Kč s DPH.
Nejlevnější elektromobil v nabídce — ideální do města, nízké provozní náklady.

Chcete probrat financování k tomuto vozu, nebo si domluvit prohlídku?
Stačí napsat — nebo zavolejte na +420 777 834 466.
```

→ **Teprve teď** karta přesměrování na inzerát vozu.

---

## Varianty výběru auta (otestováno)

### A) Elektro + město → VW e-up!

| Krok | Kdo | Zpráva |
|------|-----|--------|
| 1 | Uživatel | Hledám auto |
| 1 | Bot | Doptávací zpráva (rozpočet, palivo, převodovka…) |
| 2 | Uživatel | do 500 tisíc, elektro, automat, do města, VW |
| 2 | Bot | **VW e-up! — 379 000 Kč** + odkaz |

### B) Diesel + kombi → VW Passat

| Krok | Uživatel | Bot |
|------|----------|-----|
| 1 | Chci auto | Doptávání |
| 2 | do 500 tisíc, diesel, automat, kombi na delší trasy | **VW Passat 2.0 TDi — 447 000 Kč** |

### C) SUV + benzín → Seat Ateca

| Krok | Uživatel | Bot |
|------|----------|-----|
| 1 | Potřebuji vybrat auto | Doptávání |
| 2 | do 650 tisíc, benzín, automat, SUV, rodinné | **Seat Ateca FR Line — 614 000 Kč** |

### D) Sport elektro → Cupra Born

| Krok | Uživatel | Bot |
|------|----------|-----|
| 1 | Co doporučíte za auto? | Doptávání |
| 2 | do 600 tisíc, elektro, automat, kompaktní sportovní | **Cupra Born — 569 000 Kč** |

### E) Částečná první zpráva → doplnění

| Krok | Uživatel | Bot |
|------|----------|-----|
| 1 | Hledám auto do 400 tisíc | Doptání na zbytek (palivo, převodovka…) |
| 2 | elektro, automat, do města | **VW e-up! — 379 000 Kč** |

---

# SCÉNÁŘ 2: Financování

## Spouštěcí fráze

- „Zajímá mě financování"
- „Chci financovat auto"
- „Dá se to na splátky?"
- „Dá se to financovat?" *(po výběru auta — bot už zná vůz)*

**Nespouští scénář:** „Nabízíte financování?" → okamžitá FAQ odpověď (Moneta, 100 %, 84 měsíců).

---

## Varianta A — uživatel zná auto od začátku

### Krok 1

**Uživatel:** `Zajímá mě financování`

**Bot:**
```
Financování vyřídíme přímo u nás přes Moneta Auto. Napište mi prosím do jedné zprávy:
• konkrétní auto z naší nabídky (např. Passat, e-up!, Cupra Born, Seat Ateca…)
• zda plánujete akontaci, nebo financovat co nejvíc z ceny
• zda preferujete nižší splátku, nebo rychlejší splacení

Příklad: „název vozu z nabídky, bez akontace, nižší splátka".
```

### Krok 2 — Passat

**Uživatel:** `Passat, bez akontace, nižší splátka`

**Bot:**
```
Shrnu financování pro vůz Volkswagen Passat 2,0 TDi DSG Business… (447 000 Kč s DPH):

• Akontace: spíš minimální / až 100 % financování
• Splátky: spíš nižší měsíční splátka (delší období až 84 měsíců)

Financování přes Moneta Auto:
- financování až 100 % ceny vozu 447 000 Kč
- splácení až 84 měsíců (7 let)
- vyřízení na místě v Uherském Brodě
- potřebujete občanku a výpis z účtu

Přesnou výši splátky vám spočítáme osobně podle schválení.
Více na Financování.

Chcete si domluvit termín? Zavolejte na +420 777 834 466.
```

→ Karta přesměrování na `autoaws.cz/financovani/`

### Krok 2 — e-up!

**Uživatel:** `e-up, bez akontace, rychlejší splacení`

**Bot:** shrnutí k **VW e-up! — 379 000 Kč** + Moneta Auto + odkaz

---

## Varianta B — po výběru auta (propojení scénářů)

| Krok | Uživatel | Bot |
|------|----------|-----|
| 1 | Hledám auto | Doptávání |
| 2 | do 500 tisíc, elektro, automat, do města, VW | **VW e-up! — 379 000 Kč** *(uloží se do session)* |
| 3 | Dá se to financovat? | Ano, **e-up! (379 000 Kč)** jde financovat přes Moneta Auto… + doptání akontace/splátek |
| 4 | bez akontace, nižší splátka | Finální shrnutí **k e-up! za 379 000 Kč** + odkaz |

---

# Propojení obou scénářů

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  Výběr auta     │ ──► │  Doporučení vozu │ ──► │  Financování k vozu │
│  (1× doptání)   │     │  + přesměrování  │     │  (cena konkrétního  │
│                 │     │  na inzerát      │     │   auta z nabídky)   │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
```

Bot si pamatuje vybraný vůz v `session.selectedCar` — financování vždy sedí na správné auto a jeho cenu.

---

# Katalog vozů (products.json)

| Vůz | Cena s DPH | Palivo | Typ | Vhodné pro |
|-----|------------|--------|-----|------------|
| [VW e-up! 61kW Style](https://autoaws.cz/automobily/Volkswagen-e-up!-61kW-Style-LED-Kamera-APP-969009) | 379 000 Kč | elektro | městské | město, rozpočet do 400k |
| [VW Passat 2.0 TDi DSG](https://autoaws.cz/automobily/Volkswagen-Passat-2,0-TDi-DSG-Business-IQ-Light-Kamera-969545) | 447 000 Kč | diesel | kombi | delší trasy, do 500k |
| [Cupra Born 150kW](https://autoaws.cz/automobily/Cupra-Born-150kW-LED-Tepelko-Kamera-968739) | 569 000 Kč | elektro | kompaktní | sportovnější elektro |
| [Seat Ateca 1.5 TSi DSG FR Line](https://autoaws.cz/automobily/Seat-Ateca-1,5-TSi-DSG-FR-Line-Virtual-LED-ACC-882279) | 614 000 Kč | benzín | SUV | rodinné SUV |

---

# Ostatní FAQ (bez scénáře)

| Dotaz | Chování bota |
|-------|--------------|
| Obchodní podmínky | Vysvětlí, že samostatná stránka není — odkaz na financování, záruku, kontakt |
| Kontakt | +420 777 834 466, info@autoaws.cz, adresa showroomu |
| Doprava a platba | Převzetí v showroomu Uherský Brod, financování Moneta Auto |
| Reklamace | Postup dle zákona + kontakt |
| GDPR | Ochrana osobních údajů + přesměrování |
| O firmě | Auto AWS od 1998, VW Group značky z Německa |
| Akce / slevy | Není veřejný seznam — ověřit telefonicky |

---

# Přesměrování (UI)

| Situace | Karta Ano/Ne |
|---------|--------------|
| Doptávání (krok 1) | **Ne** |
| Doporučení 1 vozu | **Ano** → inzerát na autoaws.cz |
| Financování — finále | **Ano** → autoaws.cz/financovani/ |
| FAQ bez odkazu | **Ne** |

Text v chatu je vždy čistý (bez URL) — odkaz je jen v kartě přesměrování.

---

# Testování

```bash
# Spustit server
npm start

# Základní scénáře (3 testy)
node tests/scenarios.test.js

# Kompletní scénáře (9 testů — všechny varianty výše)
node tests/scenarios-full.test.js

# FAQ (18 testů)
node tests/qa.test.js
```

**Výsledek posledního běhu:**
- `scenarios-full.test.js` → **9/9 OK**
- `scenarios.test.js` → **3/3 OK**
- `qa.test.js` → **18/18 OK**

---

# Kontakt pro eskalaci

Když bot nemá ověřenou informaci (sklad, individuální sleva, přesná splátka):
- **Telefon:** +420 777 834 466
- **E-mail:** info@autoaws.cz
- **Showroom:** Cihlářská 422, Havřice, 688 01 Uherský Brod (Po–Pá 9–17, So 9–11)
