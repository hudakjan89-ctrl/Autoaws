# Scénáře chatbota Auto AWS

Chatbot podporuje **2 hlavní vícekrokové scénáře** — nejdřív se doptá, pak doporučí. Logika je v `scenarios.js`.

---

## Scénář 1: Výběr auta (car finder)

**Spuštění:** „Hledám auto…", „Chci auto do 500 tisíc", „Co doporučíte?", „Potřebuji vybrat auto"

### Průběh konverzace

| Krok | Kdo | Zpráva |
|------|-----|--------|
| 1 | **Uživatel** | Hledám auto do 500 tisíc. |
| 1 | **Bot** | Rád pomůžu s výběrem. **Jaké palivo preferujete?** Benzín, diesel, nebo elektro? |
| 2 | **Uživatel** | Elektro. |
| 2 | **Bot** | **Jaký typ auta hledáte?** Spíš menší do města, kombi/sedan na delší trasy, nebo SUV? |
| 3 | **Uživatel** | Do města, ideálně VW. |
| 3 | **Bot** | **Máte preferenci značky?** (VW, Škoda, Audi, Seat, Cupra…) — nebo je to jedno? |
| 4 | **Uživatel** | VW mi stačí. |
| 4 | **Bot** | Na základě toho doporučí konkrétní vůz z nabídky + odkaz + nabídka financování / prohlídky |

### Příklad finální odpovědi bota

```
Na základě toho, co jste mi řekl/a, bych doporučil:

**Volkswagen e-up! 61kW Style** — 379 000 Kč s DPH.
Nejlevnější elektromobil v nabídce — ideální do města, nízké provozní náklady.

[Volkswagen e-up! 61kW Style LED Kamera APP](https://autoaws.cz/automobily/...)

Chcete probrat financování, nebo si domluvit prohlídku v showroomu?
Zavolejte na +420 777 834 466 nebo napište na info@autoaws.cz.
```

→ Zobrazí se **karta přesměrování** (Ano / Ne) na odkaz vozu.

### Co se bot ptá (v tomto pořadí)

1. Rozpočet (pokud chybí)
2. Palivo (benzín / diesel / elektro)
3. Typ (město / kombi / SUV)
4. Značka (nebo „je to jedno")

---

## Scénář 2: Financování

**Spuštění:** „Chci financování", „Dá se to na splátky?", „Kolik by byla měsíční splátka?", „Moneta Auto"

### Průběh konverzace

| Krok | Kdo | Zpráva |
|------|-----|--------|
| 1 | **Uživatel** | Zajímá mě financování auta. |
| 1 | **Bot** | Financování vyřídíme přes **Moneta Auto**. **O jaký vůz jde, nebo v jaké cenové relaci plánujete nakupovat?** |
| 2 | **Uživatel** | Passat kolem 450 tisíc. |
| 2 | **Bot** | **Plánujete akontaci**, nebo chcete financovat co nejvíc z ceny vozu (až 100 %)? |
| 3 | **Uživatel** | Bez akontace, co nejvíc. |
| 3 | **Bot** | **Preferujete spíš nižší měsíční splátku** (delší splácení až 84 měsíců), nebo **rychlejší splacení**? |
| 4 | **Uživatel** | Nižší splátka. |
| 4 | **Bot** | Shrnutí + podmínky Moneta Auto + odkaz na financování + kontakt |

### Příklad finální odpovědi bota

```
Shrnu to pro vás:

- Cenová relace: do cca 450 000 Kč
- Akontace: spíš minimální / až 100 % financování
- Splátky: spíš nižší měsíční splátka (delší období)

**Financování přes Moneta Auto:**
- až 100 % ceny vozu
- splácení až 84 měsíců (7 let)
- vyřízení na místě v Uherském Brodě
- potřebujete občanku a výpis z účtu

Přesné splátky závisí na bonitě — rádi to spočítáme osobně.
Více na Financování (autoaws.cz/financovani/).

Chcete si domluvit termín? Zavolejte na +420 777 834 466.
```

→ Zobrazí se **karta přesměrování** na `/financovani/`.

---

## Propojení scénářů

Typický tok zákazníka:

1. **Výběr auta** → doporučení vozu
2. Uživatel: „A dá se to financovat?" → **Scénář financování** (bot už zná vůz z konverzace)

---

## Ostatní dotazy (bez scénáře)

| Otázka | Chování |
|--------|---------|
| Obchodní podmínky | FAQ odpověď, bez přesměrování na neexistující stránku |
| Kontakt | Telefon, e-mail, adresa showroomu |
| Reklamace, GDPR, Doprava | FAQ + případná karta přesměrování |

---

## Katalog vozů (`knowledge/products.json`)

| Vůz | Cena | Vhodné pro |
|-----|------|------------|
| VW e-up! | 379 000 Kč | město, elektro, rozpočet do 400k |
| VW Passat 2.0 TDi | 447 000 Kč | diesel, delší trasy, do 500k |
| Cupra Born | 569 000 Kč | sportovnější elektro |
| Seat Ateca FR Line | 614 000 Kč | rodinné SUV, benzín |
