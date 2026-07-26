# Scénáře chatbota Auto AWS

## 1. Obchodní podmínky

**Uživatel:** Jaké jsou vaše obchodní podmínky?

**Bot (očekávané chování):**
- Vysvětlí, že samostatná stránka OP na webu není v menu
- Odkáže na sekce Financování, Záruka, Pojištění, Kontakt
- Nabídne kontakt info@autoaws.cz / +420 777 834 466
- Nevymýšlí právní text

---

## 2. Hledání auta do rozpočtu (hlavní scénář)

**Uživatel:** Hledám auto do 500 tisíc.

**Bot:**
- Zeptá se na doplnění: palivo? typ (SUV/sedan/město)? značka? ročník?
- Příklad: „Rád pomůžu. Preferujete spíš benzín, diesel, nebo elektro? A hledáte spíš menší auto do města, nebo větší na delší trasy?"

**Uživatel:** Elektro, do města, ideálně VW.

**Bot:**
- Doporučí konkrétní vůz z nabídky s cenou a komentářem
- Přidá klikací odkaz, např.:

```
Pro městské ježdění bych doporučil Volkswagen e-up! za 379 000 Kč s DPH — nízké provozní náklady a skvělá výbava.

[Volkswagen e-up! 61kW Style](https://autoaws.cz/automobily/Volkswagen-e-up!-61kW-Style-LED-Kamera-APP-969009)

Chcete probrat i financování? Máme Moneta Auto až na 100 % ceny vozu.
```

---

## 3. Financování po doporučení

**Uživatel:** A dá se to financovat?

**Bot:**
- Moneta Auto, až 100 %, až 84 měsíců
- Občanka + výpis z účtu
- Odkaz: https://autoaws.cz/financovani/

---

## 4. Kontakt a showroom

**Uživatel:** Můžu přijet na prohlídku?

**Bot:**
- Adresa Cihlářská 422, Uherský Brod
- Po–Pá 9–17, So 9–11
- Doporučí zavolat a domluvit termín

---

## 5. Přesměrování na sekci webu

| Otázka | Sekce / odkaz |
|--------|----------------|
| Jaké máte auta? | https://autoaws.cz/automobily/ |
| Financování | https://autoaws.cz/financovani/ |
| Záruka | https://autoaws.cz/zaruka/ |
| Pojištění | https://autoaws.cz/pojisteni/ |
| Kontakt | https://autoaws.cz/kontakt/ |
| Ochrana údajů | https://autoaws.cz/zpracovani-osobnich-udaju/ |

---

## Doporučené vozy v katalogu (products.json)

| Vůz | Cena | Vhodné pro |
|-----|------|------------|
| VW e-up! | 379 000 Kč | město, elektro, rozpočet do 400k |
| VW Passat 2.0 TDi | 447 000 Kč | diesel, delší trasy, do 500k |
| Cupra Born | 569 000 Kč | sportovnější elektro |
| Seat Ateca FR Line | 614 000 Kč | rodinné SUV, benzín |

*Pošleš-li vlastní 2 produkty, nahradíme je v `knowledge/products.json`.*
