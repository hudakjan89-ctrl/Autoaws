/**
 * Auto AWS — vícekrokové scénáře (výběr auta, financování).
 * Deterministické odpovědi bez LLM — chatbot se doptává a pak doporučí.
 */
const fs = require("fs");
const path = require("path");

let PRODUCTS = [];
try {
    PRODUCTS = JSON.parse(fs.readFileSync(path.join(__dirname, "knowledge", "products.json"), "utf8"));
} catch (e) { /* prázdný katalog */ }

function deacc(s) {
    return String(s || "").toLowerCase()
        .replace(/[áä]/g, "a").replace(/[čć]/g, "c").replace(/[ďđ]/g, "d")
        .replace(/[éěë]/g, "e").replace(/[íï]/g, "i").replace(/[ľĺ]/g, "l")
        .replace(/[ňń]/g, "n").replace(/[óöô]/g, "o").replace(/[řŕ]/g, "r")
        .replace(/[šś]/g, "s").replace(/[ťţ]/g, "t").replace(/[úůü]/g, "u")
        .replace(/[ýÿ]/g, "y").replace(/[žź]/g, "z");
}

function parseBudgetCzk(text) {
    if (!text) return null;
    const low = deacc(text);
    let m = low.match(/do\s+(\d{1,3})\s*(tisic|tisic|k|tis)/);
    if (m) return parseInt(m[1], 10) * 1000;
    m = low.match(/do\s+(\d[\d\s]{2,8})\s*(kc|kč)?/);
    if (m) {
        const n = parseInt(m[1].replace(/\s/g, ""), 10);
        if (n >= 10000 && n <= 5000000) return n;
    }
    m = low.match(/(\d{2,3})\s*k\b/);
    if (m) {
        let n = parseInt(m[1], 10) * 1000;
        if (n < 100000 && /(auto|vuz|voz|automobil|skoda|vw|audi)/.test(low)) n *= 10;
        return n;
    }
    m = low.match(/(\d{3,7})\s*(tisic|tisic|kč|kc)/);
    if (m) {
        const n = parseInt(m[1], 10);
        if (n >= 50 && n <= 999) return n * 1000;
    }
    return null;
}

const CAR_START = /(hled[aá]m\s+auto|chci\s+(auto|v[uů]z|automobil)|potrebuj(em|u)\s+auto|potřebuj[ií]\s+auto|vyber(em|u|te)?\s+auto|vyb[eě]r\s+auta|dopor[uč][tí]\s+(auto|v[uů]z)|co\s+dopor[uč][í]te|nakup\s+auta|koupit\s+auto|hľadám\s+auto)/i;
const FIN_START = /(chci\s+financov|zaj[ií]m[aá].*financov|financovat\s+(auto|v[uů]z)|na\s+spl[aá]tk|uver|úv[eě]r|uv[eě]r|moneta|kolik\s+(by\s+)?(m[eě]s[ií][cč]n[eě]|spl[aá]tk)|d[aá]\s+se\s+(to\s+)?financovat|potrebujem\s+financov|potřebuj[ií]\s+financov)/i;
const EXIT_SCENARIO = /(kontakt|reklamac|gdpr|obchodn[ií]\s+podm|doprav|zavol|telefon|info@)/i;

function userTexts(session) {
    return (session.messages || [])
        .filter(function (m) { return m.role === "user"; })
        .map(function (m) { return m.content; });
}

function detectFuel(text) {
    const low = deacc(text);
    if (/elektr|bev|ev\b|elektro/.test(low)) return "elektro";
    if (/diesel|naft/.test(low)) return "diesel";
    if (/benzin|benz/.test(low)) return "benzín";
    if (/cokoliv|nezalezi|nevad[ií]|jedno|neviem|nev[ií]m/.test(low)) return "any";
    return null;
}

function detectCarType(text) {
    const low = deacc(text);
    if (/suv|terenn|rodin/.test(low)) return "SUV";
    if (/mesto|město|mestsk|do\s+mesta/.test(low)) return "městské";
    if (/kombi|sedan|del[sš]i|delku|cestov/.test(low)) return "kombi/sedan";
    if (/kompakt|sport/.test(low)) return "kompaktní";
    if (/cokoliv|nezalezi|nevad[ií]|jedno/.test(low)) return "any";
    return null;
}

function detectBrand(text) {
    const low = deacc(text);
    const map = [
        ["volkswagen", /vw|volkswagen/],
        ["Škoda", /skoda/],
        ["Audi", /audi/],
        ["Seat", /seat/],
        ["Cupra", /cupra/]
    ];
    for (let i = 0; i < map.length; i++) {
        if (map[i][1].test(low)) return map[i][0];
    }
    if (/nezalezi|nevad[ií]|jedno|cokoliv|neviem|nev[ií]m|zadn|žádn|zadna/.test(low)) return "any";
    return null;
}

function parseCarPrefs(session) {
    const combined = userTexts(session).join(" ");
    return {
        budget: parseBudgetCzk(combined),
        fuel: detectFuel(combined),
        type: detectCarType(combined),
        brand: detectBrand(combined)
    };
}

function parseFinancePrefs(session) {
    const combined = userTexts(session).join(" ");
    const low = deacc(combined);
    let priceRange = parseBudgetCzk(combined);
    if (!priceRange && /(\d{3,4})\s*(tisic|tisic)/.test(low)) {
        const m = low.match(/(\d{3,4})\s*(tisic|tisic)/);
        if (m) priceRange = parseInt(m[1], 10) * 1000;
    }
    let downPayment = null;
    if (/bez\s+akontace|100\s*%|co\s+nejvic|co\s+nejvíce|maximaln|maximáln/.test(low)) downPayment = "minimal";
    else if (/akontac|záloh|zalo|vlastn[ií]\s+prostred|vlastní\s+prostřed/.test(low)) downPayment = "yes";
  else if (/neviem|nev[ií]m|nevim|jeste\s+nevim|ještě\s+nevím/.test(low)) downPayment = "unknown";

    let termPref = null;
    if (/nizs[ií]|nižší|mens[ií]|menší|dels[ií]|delší|84|7\s*let/.test(low)) termPref = "lower_payment";
    else if (/rychlej|krats[ií]|kratší|drive|dřív|36|48/.test(low)) termPref = "faster";
    else if (/neviem|nev[ií]m|nevim|jedno|nezalezi/.test(low)) termPref = "any";

    // vůz z předchozího doporučení v konverzaci
    let carHint = null;
    PRODUCTS.forEach(function (p) {
        const slug = deacc(p.name.split(" ")[0] + " " + (p.name.split(" ")[1] || ""));
        if (low.indexOf(deacc(p.brand)) !== -1 || low.indexOf(slug.slice(0, 8)) !== -1) carHint = p;
    });

    return { priceRange: priceRange, downPayment: downPayment, termPref: termPref, carHint: carHint };
}

function matchProductsFromPrefs(prefs, max) {
    max = max || 2;
    if (!PRODUCTS.length) return [];
    let list = PRODUCTS.slice();
    if (prefs.budget) list = list.filter(function (p) { return p.price_czk <= prefs.budget; });
    if (prefs.fuel && prefs.fuel !== "any") list = list.filter(function (p) { return p.fuel === prefs.fuel; });
    if (prefs.type && prefs.type !== "any") {
        list = list.filter(function (p) {
            return p.type === prefs.type || (prefs.type === "kombi/sedan" && p.type.indexOf("kombi") !== -1);
        });
    }
    if (prefs.brand && prefs.brand !== "any") {
        list = list.filter(function (p) {
            return deacc(p.brand).indexOf(deacc(prefs.brand)) !== -1;
        });
    }
    list.sort(function (a, b) { return a.price_czk - b.price_czk; });
    if (!list.length && prefs.budget) {
        list = PRODUCTS.filter(function (p) { return p.price_czk <= prefs.budget * 1.15; })
            .sort(function (a, b) { return a.price_czk - b.price_czk; });
    }
    return list.slice(0, max);
}

function nextCarQuestion(prefs, asked) {
    const has = function (field, val) {
        return val && val !== "any";
    };
    if (!prefs.budget && asked.indexOf("budget") === -1) {
        return { key: "budget", text: "Rád pomůžu s výběrem. **Jaký je váš orientační rozpočet na auto?** (např. do 400 tisíc, do 500 tisíc…)" };
    }
    if (!has("fuel", prefs.fuel) && asked.indexOf("fuel") === -1) {
        return { key: "fuel", text: "Díky! **Jaké palivo preferujete?** Benzín, diesel, nebo elektro?" };
    }
    if (!has("type", prefs.type) && asked.indexOf("type") === -1) {
        return { key: "type", text: "**Jaký typ auta hledáte?** Spíš menší do města, kombi/sedan na delší trasy, nebo SUV?" };
    }
    if (!has("brand", prefs.brand) && asked.indexOf("brand") === -1) {
        return { key: "brand", text: "**Máte preferenci značky?** (VW, Škoda, Audi, Seat, Cupra…) — nebo je to jedno?" };
    }
    return null;
}

function buildCarRecommendation(prefs) {
    const hits = matchProductsFromPrefs(prefs, 2);
    if (!hits.length) {
        return "V této kombinaci požadavků nemám v aktuální nabídce ideální shodu — podívejte se prosím na [Nabídka automobilů](https://autoaws.cz/automobily/) nebo zavolejte na **+420 777 834 466**, rádi vám poradíme osobně.";
    }
    const intro = "Na základě toho, co jste mi řekl/a, bych doporučil:";
    const blocks = hits.map(function (p) {
        return "**" + p.name + "** — " + p.price_czk.toLocaleString("cs-CZ") + " Kč s DPH.\n" + p.note + "\n\n[" + p.name + "](" + p.url + ")";
    });
    return intro + "\n\n" + blocks.join("\n\n") + "\n\nChcete probrat **financování**, nebo si domluvit **prohlídku v showroomu**? Zavolejte na +420 777 834 466 nebo napište na info@autoaws.cz.";
}

function nextFinanceQuestion(prefs, asked) {
    if (!prefs.priceRange && !prefs.carHint && asked.indexOf("price") === -1) {
        return {
            key: "price",
            text: "Financování vyřídíme přímo u nás přes **Moneta Auto**. **O jaký vůz jde, nebo v jaké cenové relaci plánujete nakupovat?** (např. do 500 tisíc, Passat…)"
        };
    }
    if (!prefs.downPayment && asked.indexOf("down") === -1) {
        return {
            key: "down",
            text: "**Plánujete akontaci**, nebo chcete financovat co nejvíc z ceny vozu (až 100 %)?"
        };
    }
    if (!prefs.termPref && asked.indexOf("term") === -1) {
        return {
            key: "term",
            text: "**Preferujete spíš nižší měsíční splátku** (delší splácení až 84 měsíců), nebo **rychlejší splacení**?"
        };
    }
    return null;
}

function buildFinanceAnswer(prefs) {
    let intro = "Shrnu to pro vás:\n\n";
    if (prefs.carHint) {
        intro += "- Vůz: **" + prefs.carHint.name + "** (" + prefs.carHint.price_czk.toLocaleString("cs-CZ") + " Kč s DPH)\n";
    } else if (prefs.priceRange) {
        intro += "- Cenová relace: do cca **" + prefs.priceRange.toLocaleString("cs-CZ") + " Kč**\n";
    }
    if (prefs.downPayment === "minimal") intro += "- Akontace: spíš **minimální / až 100 % financování**\n";
    else if (prefs.downPayment === "yes") intro += "- Akontace: **ano, plánujete vlastní prostředky**\n";
    if (prefs.termPref === "lower_payment") intro += "- Splátky: spíš **nižší měsíční splátka** (delší období)\n";
    else if (prefs.termPref === "faster") intro += "- Splátky: spíš **rychlejší splacení**\n";

    intro += "\n**Financování přes Moneta Auto:**\n";
    intro += "- až **100 %** ceny vozu\n";
    intro += "- splácení až **84 měsíců** (7 let)\n";
    intro += "- vyřízení **na místě** v Uherském Brodě\n";
    intro += "- potřebujete **občanku** a **výpis z účtu**\n\n";
    intro += "Přesné splátky a schválení závisí na bonitě — rádi to spočítáme osobně. Více na [Financování](https://autoaws.cz/financovani/).\n\n";
    intro += "Chcete si domluvit termín? Zavolejte na **+420 777 834 466** nebo napište na **info@autoaws.cz**.";
    return intro;
}

function detectScenarioStart(message) {
    const low = deacc(message);
    if (CAR_START.test(message)) return "car_finder";
    // Jednoduché FAQ „nabízíte financování?" → intent override, ne vícekrokový scénář
    if (/^(nab[ií]z[ií]te|m[aá]te|jak|co)\s/.test(low) && /financov/.test(low)) return null;
    if (FIN_START.test(message)) return "financing";
    return null;
}

/**
 * @returns {{ reply: string, state: object|null, done: boolean }|null}
 */
function handleScenario(session, message) {
    if (EXIT_SCENARIO.test(message) && session.scenario) {
        session.scenario = null;
        return null;
    }

    let scen = session.scenario;

    if (!scen) {
        const start = detectScenarioStart(message);
        if (!start) return null;
        scen = { type: start, asked: [] };
    }

    if (scen.type === "car_finder") {
        const prefs = parseCarPrefs(session);
        const q = nextCarQuestion(prefs, scen.asked);
        if (q) {
            scen.asked.push(q.key);
            session.scenario = scen;
            return { reply: q.text, state: scen, done: false };
        }

        session.scenario = null;
        return { reply: buildCarRecommendation(prefs), state: null, done: true };
    }

    if (scen.type === "financing") {
        const prefs = parseFinancePrefs(session);
        const q = nextFinanceQuestion(prefs, scen.asked);
        if (q) {
            scen.asked.push(q.key);
            session.scenario = scen;
            return { reply: q.text, state: scen, done: false };
        }
        session.scenario = null;
        return { reply: buildFinanceAnswer(prefs), state: null, done: true };
    }

    session.scenario = null;
    return null;
}

module.exports = { handleScenario, parseCarPrefs, parseFinancePrefs, detectScenarioStart };
