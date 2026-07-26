/**
 * Auto AWS — vícekrokové scénáře (výběr auta, financování).
 * Jedna přátelská zpráva s více otázkami, přesměrování až na konci.
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
    m = low.match(/(\d{3,4})\s*(tisic|tisic)/);
    if (m) return parseInt(m[1], 10) * 1000;
    return null;
}

const CAR_START = /(hled[aá]m\s+auto|chci\s+(auto|v[uů]z|automobil)|potrebuj(em|u)\s+auto|potřebuj[ií]\s+auto|vyber(em|u|te)?\s+auto|vyb[eě]r\s+auta|dopor[uč][tí]\s+(auto|v[uů]z)|co\s+dopor[uč][í]te|nakup\s+auta|koupit\s+auto|hľadám\s+auto)/i;
const FIN_START = /(chci\s+financov|zaj[ií]m[aá].*financov|financovat\s+(auto|v[uů]z)|na\s+spl[aá]tk|uver|úv[eě]r|uv[eě]r|moneta|kolik\s+(by\s+)?(m[eě]s[ií][cč]n[eě]|spl[aá]tk)|d[aá]\s+se\s+(to\s+)?financovat|potrebujem\s+financov|potřebuj[ií]\s+financov)/i;
const EXIT_SCENARIO = /(kontakt|reklamac|gdpr|obchodn[ií]\s+podm|doprav|zavol|telefon|info@)/i;

const CAR_KEYWORDS = [
    { id: "e-up", re: /e-?up|e up/ },
    { id: "passat", re: /passat/ },
    { id: "born", re: /born|cupra\s+born/ },
    { id: "ateca", re: /ateca/ }
];

function userTexts(session) {
    return (session.messages || [])
        .filter(function (m) { return m.role === "user"; })
        .map(function (m) { return m.content; });
}

function allConversationText(session) {
    return (session.messages || []).map(function (m) { return m.content; }).join(" ");
}

function detectFuel(text) {
    const low = deacc(text);
    if (/elektr|bev|ev\b|elektro/.test(low)) return "elektro";
    if (/diesel|naft/.test(low)) return "diesel";
    if (/benzin|benz/.test(low)) return "benzín";
    if (/cokoliv|nezalezi|nevad[ií]|jedno|neviem|nev[ií]m|vsechno/.test(low)) return "any";
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

function detectTransmission(text) {
    const low = deacc(text);
    if (/automat|dsg|tiptronic|s-tronic|cvt/.test(low)) return "automat";
    if (/manual|manu[aá]l|prevodov/.test(low) && !/automat/.test(low)) return "manual";
    if (/nezalezi|nevad[ií]|jedno|cokoliv/.test(low)) return "any";
    return null;
}

function detectMaxKm(text) {
    const low = deacc(text);
    let m = low.match(/(?:max\.?|do)\s*(\d{1,3})\s*(tisic|tisic)?\s*(km|kilometr)/);
    if (m) {
        let n = parseInt(m[1], 10);
        if (m[2] || n < 500) n *= 1000;
        return n;
    }
    m = low.match(/(\d{2,3})\s*(tisic|tisic)\s*km/);
    if (m) return parseInt(m[1], 10) * 1000;
    return null;
}

function detectYearPref(text) {
    const low = deacc(text);
    let m = low.match(/(?:rocnik|ročník|od\s+roku)\s*(\d{4})/);
    if (m) return parseInt(m[1], 10);
    if (/novejsi|novější|mlade|mlad[ée]/.test(low)) return "newer";
    if (/nezalezi|nevad[ií]|jedno/.test(low)) return "any";
    return null;
}

function parseCarPrefs(session) {
    const combined = userTexts(session).join(" ");
    return {
        budget: parseBudgetCzk(combined),
        fuel: detectFuel(combined),
        type: detectCarType(combined),
        brand: detectBrand(combined),
        transmission: detectTransmission(combined),
        maxKm: detectMaxKm(combined),
        yearPref: detectYearPref(combined)
    };
}

function findProductInText(text) {
    const low = deacc(text);
    for (let i = 0; i < PRODUCTS.length; i++) {
        const p = PRODUCTS[i];
        for (let k = 0; k < CAR_KEYWORDS.length; k++) {
            if (CAR_KEYWORDS[k].re.test(low) && deacc(p.name).indexOf(CAR_KEYWORDS[k].id.replace("-", "")) !== -1) return p;
        }
        if (CAR_KEYWORDS.some(function (kw) { return kw.re.test(low) && deacc(p.name).indexOf(kw.id.replace("-", "")) !== -1; })) return p;
        if (low.indexOf(deacc(p.brand)) !== -1 && low.indexOf(deacc(p.name.split(" ")[1] || "")) !== -1) return p;
    }
    for (let k = 0; k < CAR_KEYWORDS.length; k++) {
        if (!CAR_KEYWORDS[k].re.test(low)) continue;
        for (let i = 0; i < PRODUCTS.length; i++) {
            if (deacc(PRODUCTS[i].name).indexOf(CAR_KEYWORDS[k].id.replace("-", "")) !== -1) return PRODUCTS[i];
        }
    }
    if (/passat/.test(low)) return PRODUCTS.find(function (p) { return /passat/i.test(p.name); }) || null;
    if (/e-?up/.test(low)) return PRODUCTS.find(function (p) { return /e-up/i.test(p.name); }) || null;
    if (/born/.test(low)) return PRODUCTS.find(function (p) { return /born/i.test(p.name); }) || null;
    if (/ateca/.test(low)) return PRODUCTS.find(function (p) { return /ateca/i.test(p.name); }) || null;
    return null;
}

function getSessionCar(session) {
    if (session.selectedCar) {
        return PRODUCTS.find(function (p) { return p.url === session.selectedCar.url; }) || session.selectedCar;
    }
    const fromText = findProductInText(allConversationText(session));
    if (fromText) return fromText;
    for (let i = 0; i < PRODUCTS.length; i++) {
        if (allConversationText(session).indexOf(PRODUCTS[i].url) !== -1) return PRODUCTS[i];
    }
    return null;
}

function parseFinancePrefs(session) {
    const combined = userTexts(session).join(" ");
    const low = deacc(combined);
    let downPayment = null;
    if (/bez\s+akontace|100\s*%|co\s+nejvic|co\s+nejvíce|maximaln|maximáln/.test(low)) downPayment = "minimal";
    else if (/akontac|záloh|zalo|vlastn[ií]\s+prostred|vlastní\s+prostřed/.test(low)) downPayment = "yes";
    else if (/neviem|nev[ií]m|nevim|jeste\s+nevim|ještě\s+nevím/.test(low)) downPayment = "unknown";

    let termPref = null;
    if (/nizs[ií]|nižší|mens[ií]|menší|dels[ií]|delší|84|7\s*let/.test(low)) termPref = "lower_payment";
    else if (/rychlej|krats[ií]|kratší|drive|dřív|36|48/.test(low)) termPref = "faster";
    else if (/neviem|nev[ií]m|nevim|jedno|nezalezi/.test(low)) termPref = "any";

    const car = getSessionCar(session) || findProductInText(combined);
    return { car: car, downPayment: downPayment, termPref: termPref };
}

function prefsCompleteEnough(prefs) {
    if (!prefs.budget) return false;
    let score = 0;
    if (prefs.fuel && prefs.fuel !== "any") score++;
    if (prefs.type && prefs.type !== "any") score++;
    if (prefs.brand && prefs.brand !== "any") score++;
    if (prefs.transmission && prefs.transmission !== "any") score++;
    if (prefs.maxKm) score++;
    if (prefs.yearPref && prefs.yearPref !== "any") score++;
    return score >= 2;
}

function buildCarIntakeMessage(prefs, followUp) {
    const lines = [];
    if (!prefs.budget) lines.push("orientační **rozpočet / cenu** (např. do 500 tisíc)");
    if (!prefs.fuel) lines.push("**palivo** (benzín, diesel, elektro)");
    if (!prefs.transmission) lines.push("**převodovku** (manuál / automat)");
    if (!prefs.type) lines.push("**typ auta** (do města, kombi, SUV…)");
    if (!prefs.brand) lines.push("**značku**, pokud vám na ní záleží");
    if (!prefs.maxKm) lines.push("případně **max. nájezd v km**");
    if (!prefs.yearPref) lines.push("případně **ročník** nebo stáří vozu");

    if (!lines.length) return null;

    const intro = followUp
        ? "Ještě mi prosím doplňte:"
        : "Rád pomůžu s výběrem! Abych našel vhodný vůz, napište mi prosím **do jedné zprávy**:";

    return intro + "\n• " + lines.join("\n• ")
        + "\n\nStačí stručně — třeba: „do 500 tisíc, diesel, automat, kombi, max. 150 tisíc km\".";
}

function financePrefsComplete(prefs) {
    return !!(prefs.car && prefs.downPayment && prefs.termPref);
}

function buildFinanceIntakeMessage(prefs, followUp) {
    const lines = [];
    if (!prefs.car) {
        lines.push("**konkrétní auto** z naší nabídky (např. Passat, e-up!, Cupra Born, Seat Ateca — nebo odkaz z webu)");
    }
    if (!prefs.downPayment) {
        lines.push("zda plánujete **akontaci**, nebo financovat **co nejvíc z ceny** (až 100 %)");
    }
    if (!prefs.termPref) {
        lines.push("zda preferujete **nižší měsíční splátku**, nebo **rychlejší splacení**");
    }
    if (!lines.length) return null;

    const intro = followUp
        ? "Ještě mi prosím upřesněte:"
        : (prefs.car
            ? "Financování k vozu **" + prefs.car.name.split(" ").slice(0, 3).join(" ") + "** vyřídíme přes Moneta Auto. Napište mi prosím **do jedné zprávy**:"
            : "Financování vyřídíme přímo u nás přes **Moneta Auto**. Napište mi prosím **do jedné zprávy**:");

    return intro + "\n• " + lines.join("\n• ")
        + "\n\nPříklad: „Passat, bez akontace, nižší splátka\".";
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
    if (prefs.transmission && prefs.transmission !== "any") {
        list = list.filter(function (p) {
            const auto = /dsg|automat|elektro/i.test(p.name + " " + (p.transmission || ""));
            if (prefs.transmission === "automat") return auto;
            if (prefs.transmission === "manual") return !auto;
            return true;
        });
    }
    list.sort(function (a, b) { return a.price_czk - b.price_czk; });
    if (!list.length && prefs.budget) {
        list = PRODUCTS.filter(function (p) { return p.price_czk <= prefs.budget * 1.15; })
            .sort(function (a, b) { return a.price_czk - b.price_czk; });
    }
    return list.slice(0, max);
}

function buildCarRecommendation(prefs) {
    const hits = matchProductsFromPrefs(prefs, 2);
    if (!hits.length) {
        return {
            reply: "V této kombinaci požadavků nemám v aktuální nabídce ideální shodu — podívejte se prosím na [Nabídka automobilů](https://autoaws.cz/automobily/) nebo zavolejte na **+420 777 834 466**, rádi vám poradíme osobně.",
            selectedCar: null
        };
    }

    let detail = "";
    if (prefs.maxKm) detail += " (nájezd do " + prefs.maxKm.toLocaleString("cs-CZ") + " km ověřte v inzerátu)";
    if (prefs.transmission && prefs.transmission !== "any") {
        detail += " — převodovka: " + (prefs.transmission === "automat" ? "automat" : "manuál");
    }

    const intro = "Na základě vašich požadavků" + detail + " bych doporučil:";
    const blocks = hits.map(function (p) {
        return "**" + p.name + "** — " + p.price_czk.toLocaleString("cs-CZ") + " Kč s DPH.\n" + p.note + "\n\n[" + p.name + "](" + p.url + ")";
    });
  return {
        reply: intro + "\n\n" + blocks.join("\n\n")
            + "\n\nChcete probrat **financování** k tomuto vozu, nebo si domluvit **prohlídku**? Stačí napsat — nebo zavolejte na +420 777 834 466.",
        selectedCar: hits[0]
    };
}

function buildFinanceAnswer(prefs) {
    const car = prefs.car;
    if (!car) {
        return {
            reply: "Abych spočítal financování, potřebuji vědět **o jaké konkrétní auto jde** z naší nabídky (např. Passat, e-up!, Cupra Born). Napište název vozu a vaše preference k akontaci a splátkám.",
            selectedCar: null
        };
    }

    let intro = "Shrnu financování pro vůz **" + car.name + "** (" + car.price_czk.toLocaleString("cs-CZ") + " Kč s DPH):\n\n";

    if (prefs.downPayment === "minimal") intro += "• Akontace: spíš **minimální / až 100 % financování**\n";
    else if (prefs.downPayment === "yes") intro += "• Akontace: **ano, plánujete vlastní prostředky**\n";
    else intro += "• Akontace: dle vaší situace (lze až **100 %** ceny vozu)\n";

    if (prefs.termPref === "lower_payment") intro += "• Splátky: spíš **nižší měsíční splátka** (delší období až 84 měsíců)\n";
    else if (prefs.termPref === "faster") intro += "• Splátky: spíš **rychlejší splacení**\n";
    else intro += "• Splátky: dle dohody (až **84 měsíců**)\n";

    intro += "\n**Financování přes Moneta Auto:**\n";
    intro += "- financování až **100 %** ceny vozu **" + car.price_czk.toLocaleString("cs-CZ") + " Kč**\n";
    intro += "- splácení až **84 měsíců** (7 let)\n";
    intro += "- vyřízení **na místě** v Uherském Brodě\n";
    intro += "- potřebujete **občanku** a **výpis z účtu**\n\n";
    intro += "Přesnou výši splátky vám spočítáme osobně podle schválení — závisí na bonitě a akontaci. Více na [Financování](https://autoaws.cz/financovani/).\n\n";
    intro += "Chcete si domluvit termín? Zavolejte na **+420 777 834 466** nebo napište na **info@autoaws.cz**.";

    return { reply: intro, selectedCar: car };
}

function detectScenarioStart(message, session) {
    const low = deacc(message);
    if (CAR_START.test(message)) return "car_finder";
    if (/^(nab[ií]z[ií]te|m[aá]te|jak|co)\s/.test(low) && /financov/.test(low)) return null;
    if (FIN_START.test(message)) return "financing";
    return null;
}

function handleScenario(session, message) {
    if (EXIT_SCENARIO.test(message) && session.scenario) {
        session.scenario = null;
        return null;
    }

    let scen = session.scenario;

    if (!scen) {
        const start = detectScenarioStart(message, session);
        if (!start) return null;
        scen = { type: start, intakeSent: false };
    }

    if (scen.type === "car_finder") {
        const prefs = parseCarPrefs(session);

        if (!prefsCompleteEnough(prefs)) {
            const msg = buildCarIntakeMessage(prefs, scen.intakeSent);
            if (msg) {
                scen.intakeSent = true;
                session.scenario = scen;
                return { reply: msg, state: scen, done: false, selectedCar: null };
            }
        }

        const result = buildCarRecommendation(prefs);
        session.scenario = null;
        return { reply: result.reply, state: null, done: true, selectedCar: result.selectedCar };
    }

    if (scen.type === "financing") {
        const prefs = parseFinancePrefs(session);

        if (!financePrefsComplete(prefs)) {
            if (prefs.car && !scen.intakeSent) {
                scen.intakeSent = true;
                session.scenario = scen;
                const short = prefs.car.name.split(" ").slice(0, 4).join(" ");
                return {
                    reply: "Ano, vůz **" + short + "** (" + prefs.car.price_czk.toLocaleString("cs-CZ") + " Kč s DPH) u nás financovat jde — přes **Moneta Auto**, až **100 %** ceny, splácení až **84 měsíců**, vyřízení na místě.\n\n"
                        + "Abych vám to upřesnil, napište prosím **do jedné zprávy**:\n"
                        + "• zda plánujete **akontaci**, nebo financovat co nejvíc z ceny\n"
                        + "• zda preferujete **nižší splátku**, nebo **rychlejší splacení**",
                    state: scen,
                    done: false,
                    selectedCar: prefs.car
                };
            }
            const msg = buildFinanceIntakeMessage(prefs, scen.intakeSent);
            if (msg) {
                scen.intakeSent = true;
                session.scenario = scen;
                return { reply: msg, state: scen, done: false, selectedCar: prefs.car || null };
            }
        }

        const result = buildFinanceAnswer(prefs);
        session.scenario = null;
        return { reply: result.reply, state: null, done: true, selectedCar: result.selectedCar };
    }

    session.scenario = null;
    return null;
}

module.exports = {
    handleScenario,
    parseCarPrefs,
    parseFinancePrefs,
    detectScenarioStart,
    getSessionCar,
    findProductInText
};
