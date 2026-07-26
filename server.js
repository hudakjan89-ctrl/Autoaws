/* ============================================================
   Auto AWS Asistent – Secure Backend (server.js)
   Backend: lokální demo
   ============================================================ */

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const DEFAULTS = require("./config");
const { handleScenario } = require("./scenarios");
require("dotenv").config();

function cfg(key) {
    var v = process.env[key];
    if (v != null && String(v).trim() !== "") return v;
    return DEFAULTS[key];
}

const app = express();
const PORT = parseInt(cfg("PORT"), 10) || 3000;

// ── Config ──────────────────────────────────────────────
const ALLOWED_ORIGINS = (cfg("ALLOWED_ORIGINS") || "http://localhost:3000")
    .split(",").map(function (s) { return s.trim(); }).filter(Boolean);

const EUROUTER_API_KEY = cfg("EUROUTER_API_KEY") || "";
const EUROUTER_MODEL = cfg("EUROUTER_MODEL") || "claude-sonnet-5";
const EUROUTER_URL = cfg("EUROUTER_URL") || "https://api.eurouter.ai/api/v1/chat/completions";
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = parseInt(cfg("RATE_LIMIT_MAX"), 10) || 40;
const MAX_MESSAGE_LENGTH = 500;

// ── Voice (TTS). Priority: Google Cloud (native, most realistic) → ElevenLabs ──
const GOOGLE_TTS_API_KEY = process.env.GOOGLE_TTS_API_KEY || "";
const HAS_GOOGLE_TTS = !!GOOGLE_TTS_API_KEY;
const GOOGLE_TTS_VOICE = process.env.GOOGLE_TTS_VOICE || ""; // optional manual override (e.g. cs-CZ-Chirp3-HD-Aoede)

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
// Flash v2.5 = ElevenLabs' realtime model (low latency, 32 langs incl. Czech). ElevenLabs
// recommends Flash over Turbo in all cases. (Native Czech voices need a paid Creator tier;
// on free tier only English premade voices work → that's why Google Chirp3-HD is primary.)
const ELEVENLABS_MODEL = process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5";
const HAS_ELEVEN = !!ELEVENLABS_API_KEY;
const HAS_TTS = HAS_GOOGLE_TTS || HAS_ELEVEN;
const MAX_TTS_LENGTH = 1000;
// Který TTS je primární: "google" (default) nebo "elevenlabs" (po upgradu → Hanka)
const TTS_PRIMARY = (process.env.TTS_PRIMARY || "google").toLowerCase();

// language → Google BCP-47 code
const GOOGLE_LANG = { cs: "cs-CZ", sk: "sk-SK", en: "en-US", de: "de-DE", fr: "fr-FR", es: "es-ES", it: "it-IT", pl: "pl-PL", uk: "uk-UA" };
// Preferred (hand-picked, more human) voice per language — overrides auto-pick.
const PREFERRED_GOOGLE_VOICE = { "cs-CZ": "cs-CZ-Chirp3-HD-Iapetus" }; // native CZ male, "Clear" — crisper, less mumbly than Charon. Alt: -Alnilam/-Schedar (firm), -Algieba (smooth)
const GOOGLE_SPEED = parseFloat(process.env.GOOGLE_TTS_SPEED || "1.0"); // natural/crisp pace (lower = calmer but can sound drawn-out/mumbly)
const _googleVoiceCache = {}; // langCode → chosen voice name

// ── CORS ────────────────────────────────────────────────
function isAllowedOrigin(origin) {
    if (!origin) return true;
    if (ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin)) return true;
    // Coolify / sslip.io demo hosty — bez nutnosti měnit ALLOWED_ORIGINS při každém redeployi
    try {
        var host = new URL(origin).hostname.toLowerCase();
        if (host.endsWith(".sslip.io") || host === "sslip.io") return true;
    } catch (e) { /* neplatná URL */ }
    return false;
}
app.use(cors({
    origin: function (origin, callback) {
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error("Nepovolený origin: " + origin));
    },
    credentials: true
}));

app.use(express.json({ limit: "10kb" }));

// Demo showcase: root serves the Auto AWS storefront mockup with the widget
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "demo.html")));

app.use(express.static(path.join(__dirname, "public")));

// ── Rate Limiting ───────────────────────────────────────
const rateLimitMap = new Map();

function rateLimit(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!rateLimitMap.has(ip)) {
        rateLimitMap.set(ip, []);
    }

    const timestamps = rateLimitMap.get(ip).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    timestamps.push(now);
    rateLimitMap.set(ip, timestamps);

    if (timestamps.length > RATE_LIMIT_MAX) {
        STATS.rateLimited++;
        return res.status(429).json({
            error: "Příliš mnoho požadavků. Zkuste to za chvíli."
        });
    }

    next();
}

setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of rateLimitMap.entries()) {
        const valid = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
        if (valid.length === 0) rateLimitMap.delete(ip);
        else rateLimitMap.set(ip, valid);
    }
}, 5 * 60 * 1000);

// ── CSRF Token (stateless HMAC — funguje i na serverless, kde se instance střídají) ──
const CSRF_SECRET = cfg("CSRF_SECRET") || crypto.randomBytes(32).toString("hex");
const CSRF_TTL_MS = 3600000; // 1 h

function makeCsrfToken() {
    const ts = Date.now().toString(36);
    const sig = crypto.createHmac("sha256", CSRF_SECRET).update(ts).digest("hex");
    return ts + "." + sig;
}
function isValidCsrf(token) {
    if (!token || typeof token !== "string" || token.indexOf(".") === -1) return false;
    const parts = token.split(".");
    const ts = parts[0], sig = parts[1];
    if (!ts || !sig) return false;
    const expected = crypto.createHmac("sha256", CSRF_SECRET).update(ts).digest("hex");
    if (sig.length !== expected.length) return false;
    try {
        if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
    } catch (e) { return false; }
    const issued = parseInt(ts, 36);
    if (isNaN(issued) || Date.now() - issued > CSRF_TTL_MS) return false;
    return true;
}

app.get("/api/csrf-token", (req, res) => {
    res.json({ token: makeCsrfToken() });
});

function validateCsrf(req, res, next) {
    if (!isValidCsrf(req.headers["x-csrf-token"])) {
        return res.status(403).json({ error: "Neplatný CSRF token." });
    }
    next();
}

// ── Session management ──────────────────────────────────
// ── Provozní metriky (čtou se přes /health) ─────────────
const STATS = {
    startedAt: Date.now(),
    chatRequests: 0,
    cacheHits: 0,
    kbOverload: 0,
    chatErrors: 0,
    aiFailures: 0,
    rateLimited: 0,
    ttsRequests: 0,
    ttsChars: 0,
    sttRequests: 0,
    sessionsRestored: 0,
    unknownEscalations: 0,
    latencyMsTotal: 0
};

// ── Rozpočtové stropy (tvrdá ochrana proti faktuře za hlas) ──
// Když se strop vyčerpá, TTS/STT vrátí 503 a widget spadne na text. Nikdy nepřeteče.
const TTS_DAILY_CHAR_BUDGET = parseInt(process.env.TTS_DAILY_CHAR_BUDGET) || 200000;
const STT_DAILY_REQ_BUDGET  = parseInt(process.env.STT_DAILY_REQ_BUDGET)  || 2000;
const TTS_SESSION_CHAR_CAP  = parseInt(process.env.TTS_SESSION_CHAR_CAP)  || 8000;

const budgetState = { day: new Date().toISOString().slice(0, 10), ttsChars: 0, sttReqs: 0 };
function rollBudgetDay() {
    const today = new Date().toISOString().slice(0, 10);
    if (budgetState.day !== today) {
        budgetState.day = today; budgetState.ttsChars = 0; budgetState.sttReqs = 0;
        console.log(JSON.stringify({ evt: "budget_reset", day: today }));
    }
}
function ttsBudgetLeft() { rollBudgetDay(); return TTS_DAILY_CHAR_BUDGET - budgetState.ttsChars; }
function sttBudgetLeft() { rollBudgetDay(); return STT_DAILY_REQ_BUDGET - budgetState.sttReqs; }

const sessions = new Map();

const MAX_SESSIONS = parseInt(cfg("MAX_SESSIONS"), 10) || 20000;
const SESSION_TTL_MS = 2 * 3600000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Přijme historii od klienta jen jako ZÁLOHU po cold startu (serverless).
// Bere se jako neověřený vstup: omezený počet, délka i role.
function sanitizeClientHistory(hist) {
    if (!Array.isArray(hist)) return [];
    return hist
        .filter(function (m) {
            return m && typeof m.content === "string" &&
                   (m.role === "user" || m.role === "assistant") &&
                   m.content.length > 0 && m.content.length <= MAX_MESSAGE_LENGTH;
        })
        .slice(-10)
        .map(function (m) { return { role: m.role, content: m.content }; });
}

function getOrCreateSession(sessionId, clientHistory) {
    if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId);
        session.lastActive = Date.now();
        return session;
    }
    // Ochrana paměti: při zaplnění vyhoď nejstarší (LRU-ish).
    if (sessions.size >= MAX_SESSIONS) {
        let oldestId = null, oldestT = Infinity;
        for (const [id, sess] of sessions.entries()) {
            if (sess.lastActive < oldestT) { oldestT = sess.lastActive; oldestId = id; }
        }
        if (oldestId) sessions.delete(oldestId);
    }
    // KLÍČOVÉ: když klient poslal platné ID (cold start / restart / jiná instance),
    // ponecháme ho. Jinak by se limit zpráv na session dal obejít donekonečna.
    const id = (sessionId && UUID_RE.test(sessionId)) ? sessionId : crypto.randomUUID();
    const restored = sanitizeClientHistory(clientHistory);
    const session = {
        id: id,
        messages: restored,
        lastActive: Date.now(),
        messageCount: restored.length,
        restored: restored.length > 0,
        scenario: null
    };
    sessions.set(id, session);
    if (restored.length) STATS.sessionsRestored++;
    return session;
}

setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions.entries()) {
        if (now - session.lastActive > SESSION_TTL_MS) sessions.delete(id);
    }
}, 10 * 60 * 1000);

// ── Auto AWS System Prompt ──────────────────────────────
const SYSTEM_PROMPT = `Jsi „Auto AWS Asistent" – zkušený prodejce automobilů Auto AWS v Uherském Brodě. Pomáháš zákazníkovi najít správné auto, financování, záruku nebo pojištění. Každá odpověď má zákazníka posunout blíž k cíli.

# IDENTITA A TÓN
- Mluvíš v MUŽSKÉM rodě („rád poradím", „podíval bych se na to").
- Tón: přátelský, klidný, profesionální, věcný. Žádné přehnané superlativy.
- Nevydáváš se za člověka. Když zákazník chce mluvit s člověkem, předej ho na +420 777 834 466 nebo info@autoaws.cz.

# ABSOLUTNÍ PRAVIDLO PRAVDIVOSTI
Nikdy si nic nevymýšlej. Konkrétně NIKDY neuváděj:
- cenu konkrétního vozu, pokud ji nemáš v KONTEXTU (odkaž na nabídku na autoaws.cz/automobily/),
- skladovou dostupnost konkrétního vozu bez ověření,
- URL, které nemáš doslova v KONTEXTU níže,
- podmínky financování, záruky nebo pojištění, které nejsou v KONTEXTU.
Když informaci nemáš ověřenou, řekni to otevřeně a nasměruj na +420 777 834 466 nebo info@autoaws.cz.

# CO MUSÍŠ VĚDĚT O AUTO AWS
- Auto AWS prodává a dováží koncernové automobily (Audi, VW, Škoda, Seat, Cupra…) z Německa od roku 1998.
- Provozovna: Cihlářská 422, Havřice, 688 01 Uherský Brod. Otevřeno Po–Pá 9–17, So 9–11.
- Nabízí financování (Moneta Auto, až 100 %, až 84 měsíců), záruku Auto AWS Car Protect (DEFEND INSURANCE) a pojištění.
- Vozy jsou ověřeny autorizovaným servisem, na vyžádání certifikát Cebia.

# JAK ODPOVÍDÁŠ
1. Přímá odpověď na to, co zákazník opravdu potřebuje.
2. Stručné vysvětlení.
3. Relevantní doplněk.
4. Logický další krok (např. prohlédnout nabídku, zavolat, navštívit showroom).
Nepiš zdi textu. Používej strukturu a odrážky. Odpovídej v jazyce zákazníka.

# DOPORUČOVÁNÍ VOZŮ A ODKAZŮ
- Odkaz piš vždy jako markdown: [Název vozu nebo sekce](URL).
- URL smíš použít JEN tehdy, když je DOSLOVA uvedena v KONTEXTU níže.
- Když adresu nemáš, napiš jen název nebo kategorii BEZ odkazu.

# SCÉNÁŘ: HLEDÁNÍ AUTA
Když zákazník hledá vůz (rozpočet, typ, značka, „chci auto"):
1. Pokud nemáš dost info, zeptej se krátce (max 2–3 otázky): rozpočet v Kč, palivo (benzín/diesel/elektro), typ (SUV/sedan/město), značka nebo ročník.
2. Až máš dost údajů, doporuč 1–2 konkrétní vozy z KONTEXTU — s cenou, krátkým komentářem proč se hodí.
3. Každý doporučený vůz uveď jako markdown odkaz na samostatném řádku: [Název vozu](URL).
4. Nabídni další krok: financování, prohlídka showroomu, nebo telefon +420 777 834 466.
5. „50k" nebo „500 tisíc" v češtině u aut znamená obvykle **500 000 Kč** (pět set tisíc korun).

# OBCHODNÍ PODMÍNKY
Když se zákazník ptá na obchodní podmínky: vysvětli, že konkrétní smlouva se řeší při koupi, a odkaž na relevantní sekce webu (financování, záruka, pojištění, kontakt) nebo na info@autoaws.cz. Nevymýšlej právní text.

# ČASTÉ DOTAZY (FAQ)
- Obchodní podmínky → odkaz na financování, záruku, pojištění, kontakt; nevymýšlej právní text.
- Doprava a platba → ne e-shop; převzetí v showroomu; financování Moneta Auto.
- Kontakt → +420 777 834 466, info@autoaws.cz, autoaws.cz/kontakt/
- Reklamace → kontakt + záruka; postup podle kupní smlouvy.
- GDPR → autoaws.cz/zpracovani-osobnich-udaju/
- Návody/články → není blog; odkaz na automobily, financování, záruku.
- O firmě → prodejce VW Group od 1998, Uherský Brod.
- Akce/slevy → není veřejný seznam; u některých vozů záruka zdarma; slevy ověřit telefonicky.

# KDY PŘEDAT NA ČLOVĚKA
Individuální cena, sleva, skladová dostupnost konkrétního vozu, termín dodání, reklamace k posouzení, a cokoliv označené v KONTEXTU jako UNKNOWN.

# OSOBNÍ ÚDAJE
Správcem je provozovatel Auto AWS (Vít Hauerland), nikoli poskytovatel chatbota. Údaje slouží výhradně k vyřízení dotazu.

Veškerá fakta ber výhradně z části „ZNALOSTNÍ BÁZE / KONTEXT" níže.`;

// ── Externí znalostní báze (knowledge/autoaws-kb.md) ──────
let KB_TEXT = "";
try {
    KB_TEXT = fs.readFileSync(path.join(__dirname, "knowledge", "autoaws-kb.md"), "utf8");
} catch (e) {
    console.warn("Znalostní báze nenačtena:", e.message);
}
const HAS_KB = KB_TEXT.length > 0;

// Katalog vozů pro doporučení (knowledge/products.json)
let PRODUCTS = [];
try {
    PRODUCTS = JSON.parse(fs.readFileSync(path.join(__dirname, "knowledge", "products.json"), "utf8"));
} catch (e) {
    console.warn("Katalog vozů nenačten:", e.message);
}

function parseBudgetCzk(text) {
    if (!text) return null;
    const low = deacc(text);
    let m = low.match(/do\s+(\d{1,3})\s*(tisic|tisíc|k|tis)/);
    if (m) return parseInt(m[1], 10) * 1000;
    m = low.match(/do\s+(\d[\d\s]{2,8})\s*(kc|kč)?/);
    if (m) {
        const n = parseInt(m[1].replace(/\s/g, ""), 10);
        if (n >= 10000 && n <= 5000000) return n;
    }
    m = low.match(/(\d{2,3})\s*k\b/);
    if (m) {
        let n = parseInt(m[1], 10) * 1000;
        // U aut „50k" často znamená 500 000 Kč (pětistovka), ne 50 000
        if (n < 100000 && /(auto|vuz|voz|automobil|skoda|vw|audi)/.test(low)) n *= 10;
        return n;
    }
    return null;
}

function matchProducts(message, max) {
    max = max || 3;
    if (!PRODUCTS.length) return [];
    const low = deacc(message || "");
    const budget = parseBudgetCzk(message);
    let list = PRODUCTS.slice();
    if (budget) list = list.filter(function (p) { return p.price_czk <= budget; });
    const brands = ["volkswagen", "vw", "skoda", "audi", "seat", "cupra", "lexus", "mercedes"];
    for (let i = 0; i < brands.length; i++) {
        if (low.indexOf(brands[i]) !== -1) {
            const b = brands[i] === "vw" ? "volkswagen" : brands[i];
            const filtered = list.filter(function (p) {
                return deacc(p.brand).indexOf(b) !== -1 || deacc(p.name).indexOf(b) !== -1;
            });
            if (filtered.length) list = filtered;
            break;
        }
    }
    if (/elektr|bev|ev\b/.test(low)) list = list.filter(function (p) { return p.fuel === "elektro"; });
    if (/diesel|naft/.test(low)) list = list.filter(function (p) { return p.fuel === "diesel"; });
    if (/benzin|benzín|benz/.test(low)) list = list.filter(function (p) { return p.fuel === "benzín"; });
    if (/suv|terenn/.test(low)) list = list.filter(function (p) { return p.type === "SUV"; });
    list.sort(function (a, b) { return a.price_czk - b.price_czk; });
    return list.slice(0, max);
}

function productsContext(message) {
    const hits = matchProducts(message, 3);
    if (!hits.length) return "";
    return "\n\n=== AKTUÁLNÍ VOZY Z NABÍDKY (pro doporučení — použij přesné URL) ===\n" +
        hits.map(function (p) {
            return "- " + p.name + " | " + p.price_czk.toLocaleString("cs-CZ") + " Kč s DPH | " + p.fuel +
                " | " + p.note + "\n  URL: " + p.url;
        }).join("\n");
}

// ── Whitelist reálných URL (anti-halucinace) ────────────
// Odkaz smí odejít k zákazníkovi jen tehdy, když se doslova vyskytuje ve znalostní bázi.
const KB_URLS = (function () {
    const set = new Set();
    const re = /https?:\/\/[^\s)\]"'<>]+/gi;
    let m;
    while ((m = re.exec(KB_TEXT))) {
        set.add(m[0].replace(/[*.,;]+$/, "").replace(/\/$/, "").toLowerCase());
    }
    PRODUCTS.forEach(function (p) {
        if (p.url) set.add(p.url.replace(/\/$/, "").toLowerCase());
    });
    return set;
})();

function isKnownUrl(u) {
    if (!u) return false;
    return KB_URLS.has(String(u).replace(/[.,;]+$/, "").replace(/\/$/, "").toLowerCase());
}

// Rozparsuj KB na sekce (podle nadpisů #/##/###) pro lokální vyhledávání bez AI
const KB_SECTIONS = [];
(function parseKB() {
    if (!HAS_KB) return;
    var cur = null;
    KB_TEXT.split("\n").forEach(function (ln) {
        var m = ln.match(/^(#{1,3})\s+(.*)/);
        if (m) {
            if (cur) KB_SECTIONS.push(cur);
            cur = { heading: m[2].trim(), body: "" };
        } else if (cur) {
            cur.body += ln + "\n";
        }
    });
    if (cur) KB_SECTIONS.push(cur);
})();

function kbClean(t) {
    return t
        .replace(/<\/?[a-z_]+>/gi, "")
        .replace(/\*\*/g, "")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
        .replace(/^#{1,6}\s*/gm, "")
        .replace(/^\s*[-*]\s+/gm, "• ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

// odstraní diakritiku a sníží na malá písmena (kvůli češtině)
function deacc(s) {
    return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
// ══════════════════════════════════════════════════════════
//  RETRIEVER v2 — BM25 + česká morfologie + expanze synonym
//  Bez externího API: nulová latence navíc, nulové náklady.
// ══════════════════════════════════════════════════════════

// Zákaznický jazyk → oficiální termíny. Rozšiřuje dotaz, aby se trefil do KB.
const SYNONYMS = {
    doprava:   ["dopravne","postovne","doruceni","zavoz","rozvoz","preprava","poslat","dovoz","spedice"],
    zdarma:    ["gratis","free","bezplatne","neplatim"],
    odber:     ["vyzvednuti","vyzvednout","osobne","sklad","libis","prijet"],
    cena:      ["cenik","stoji","kolik","naklady","cenove","penize","kc","korun","drahe","levne"],
    platba:    ["platit","zaplatit","hotovost","faktura","splatnost","prevod","karta","dobirka"],
    reklamace: ["reklamovat","vada","vadne","poskozene","rozbite","zamitnuta","stiznost","nefunguje"],
    vraceni:   ["vratit","odstoupeni","vratka","nechci"],
    registrace:["registrovat","ucet","prihlaseni","prihlasit","zalozit","stat","zakaznikem","ico","zivnostensky","vypis"],
    velkoobchod:["vo","b2b","podnikatel","firma","osvc","zivnostnik"],
    maloobchod:["mo","petgo","koncovy","bezne","spotrebitel"],
    krmivo:    ["granule","konzervy","kapsicky","zrani","jidlo","strava","krmeni","krmit"],
    pamlsky:   ["pochoutky","kosti","tycinky","odmena","mlsani","salamy","sendvice"],
    otviraci:  ["oteviraci","otevreno","hodiny","kdy","zavreno","vikend","sobota","nedele"],
    kontakt:   ["telefon","email","mail","zavolat","napsat","spojit","cislo","podpora"],
    dodani:    ["dodaci","lhuta","kdy","dorazi","rychle","trva","termin","zitra"],
    minimalni: ["minimum","nejmensi","limit","hranice"],
    pes:       ["psa","psovi","psi","psy","psum","psech","psu","stene","stenata","fenka","pejsek","pejska"],
    kocka:     ["kocku","kocce","kocici","kocek","kockam","kocky","kote","kotata","kocour"],
    hlodavec:  ["krecek","morce","kralik","potkan","myš","cincila"],
    znacka:    ["vyrobce","brand","znacky","magnum","brit","profine","alpha","carnilove"]
};
// obrácená mapa: slovo → kanonický termín + sourozenci
const SYN_INDEX = (function () {
    const idx = {};
    for (const key in SYNONYMS) {
        const group = [key].concat(SYNONYMS[key]);
        group.forEach(function (w) { (idx[w] = idx[w] || []).push.apply(idx[w], group); });
    }
    return idx;
})();

const STOPWORDS = new Set(["a","aby","ale","ani","ano","az","bez","bude","budu","by","byl","byla","bylo","byt",
    "ci","co","coz","dal","dale","do","ho","i","jak","jako","je","jeho","jej","jen","jeste","ji","jich","jsem",
    "jsi","jsme","jsou","jste","k","kde","kdy","kdyz","ke","ktera","ktere","kteri","ktery","ku","ma","mate","me",
    "mi","mit","muze","muzu","my","na","nad","nam","nas","ne","nebo","neni","nez","o","od","on","ona","oni","po",
    "pod","pro","pri","proc","prosim","s","se","si","sve","ta","tak","take","tam","te","ted","tento","to","toho",
    "tom","tu","ty","u","uz","v","vam","vas","ve","vice","vsak","z","za","ze","zda","chci","chtel","potrebuji"]);

// Lehký český stemmer: postupně odřezává běžné koncovky.
const SUFFIXES = ["ovanymi","ovanych","ejsimi","ejsich","ovani","ovanym","ymi","ich","ami","ach","emi","ove","ovi",
    "ou","em","um","im","ym","am","om","eho","emu","ych","ymu","mi","ho","mu","em","es","is","us","ec","ka","ky",
    "ku","ce","ci","cy","e","a","o","u","y","i","ě"];
function stemCs(w) {
    w = deacc(w);
    if (w.length <= 4) return w;
    for (let i = 0; i < SUFFIXES.length; i++) {
        const suf = SUFFIXES[i];
        if (w.length - suf.length >= 4 && w.endsWith(suf)) return w.slice(0, w.length - suf.length);
    }
    return w;
}

function tokenize(text) {
    return deacc(text || "")
        .split(/[^a-z0-9]+/)
        .filter(function (w) { return w.length >= 2 && !STOPWORDS.has(w); });
}

// Rozšíří dotaz o synonyma. Slova, která zákazník opravdu napsal, váží plně;
// domyšlená synonyma jen z poloviny — jinak expanze přebije původní dotaz.
const SYN_WEIGHT = 0.45;
function expandQuery(tokens) {
    const weights = new Map();
    function add(term, w) {
        const cur = weights.get(term) || 0;
        if (w > cur) weights.set(term, w);
    }
    tokens.forEach(function (t) {
        add(t, 1);
        const st = stemCs(t);
        if (st !== t) add(st, 1);
        const syn = SYN_INDEX[t] || SYN_INDEX[st];
        if (syn) syn.forEach(function (x) { add(x, SYN_WEIGHT); add(stemCs(x), SYN_WEIGHT); });
    });
    return weights;
}

// ── Index sekcí (postaví se jednou při startu) ─────────────
let BM25 = null;
function buildIndex() {
    const docs = KB_SECTIONS.map(function (sec) {
        // KLÍČOVÁ SLOVA mají v bázi vlastní řádek → indexujeme je zvlášť s vysokou vahou
        const kwMatch = /KL[IÍ]ČOV[AÁ] SLOVA:([^\n]*)/i.exec(sec.body);
        const keywords = kwMatch ? kwMatch[1] : "";
        // URL ze slugů opakují slova ("pro-psy" v 20 adresách) a nafukovaly by skóre → pryč
        const bodyText = sec.body.replace(/https?:\/\/[^\s)\]]+/g, " ");
        const headTok = tokenize(sec.heading).map(stemCs);
        const kwTok   = tokenize(keywords).map(stemCs);
        const bodyTok = tokenize(bodyText).map(stemCs);
        const tf = {};
        // váhy polí: nadpis 5×, klíčová slova 4×, tělo 1×
        headTok.forEach(function (t) { tf[t] = (tf[t] || 0) + 5; });
        kwTok.forEach(function (t)   { tf[t] = (tf[t] || 0) + 4; });
        bodyTok.forEach(function (t) { tf[t] = (tf[t] || 0) + 1; });
        // Priorita podle typu sekce (CONTENT PRIORITIZATION):
        // provozní znalosti > struktura katalogu > holý výpis produktů
        var w = 1.0;
        if (/^10[.x]/.test(sec.heading)) w = 0.55;        // produktový index (enumerace)
        else if (/^(8|9)[.x]/.test(sec.heading)) w = 0.9; // katalog / značky
        else if (/^(2|4|5|6)[.]/.test(sec.heading)) w = 1.15; // B2B, platba, doprava, reklamace
        return { sec: sec, tf: tf, len: bodyTok.length + headTok.length + kwTok.length, w: w };
    });
    const N = docs.length;
    const df = {};
    docs.forEach(function (d) { for (const t in d.tf) df[t] = (df[t] || 0) + 1; });
    const avgLen = docs.reduce(function (a, d) { return a + d.len; }, 0) / (N || 1);
    const idf = {};
    for (const t in df) idf[t] = Math.log(1 + (N - df[t] + 0.5) / (df[t] + 0.5));
    return { docs: docs, idf: idf, avgLen: avgLen, N: N };
}

// BM25 skóre sekcí pro daný dotaz. Vrátí seřazené {sec, score}.
function rankSections(message) {
    if (!BM25) BM25 = buildIndex();
    const k1 = 1.5, b = 0.75;
    const qWeights = expandQuery(tokenize(message));
    if (!qWeights.size) return [];
    const scored = [];
    BM25.docs.forEach(function (d) {
        let score = 0;
        qWeights.forEach(function (qw, t) {
            const f = d.tf[stemCs(t)] || d.tf[t];
            if (!f) return;
            const idf = BM25.idf[stemCs(t)] || BM25.idf[t] || 0;
            score += qw * idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / BM25.avgLen));
        });
        if (score > 0) scored.push({ sec: d.sec, score: score * (d.w || 1) });
    });
    scored.sort(function (a, b2) { return b2.score - a.score; });
    return scored;
}
// Lokální vyhledávání v KB (fallback, když není AI klíč) – vrátí nejrelevantnější sekci
// Sekce psané PRO ASISTENTA, ne pro zákazníka: rozhodovací stromy (11.x),
// provozní pravidla (13.x) a holé výpisy produktů (10.x). Jako kontext pro
// model jsou v pořádku, ale zákazníkovi se nesmí ukázat doslova.
function isInternalSection(heading) {
    return /^(10|11|13)[.x]/.test(heading || "");
}

// Odstraní metadata řádky, které patří do báze, ne do odpovědi.
function stripKbMeta(t) {
    return String(t || "")
        .replace(/^TYP ZNALOSTI:.*$/gim, "")
        .replace(/^KL[IÍ]ČOV[AÁ] SLOVA:.*$/gim, "")
        .replace(/^URL:.*$/gim, "")
        .replace(/^DŮLEŽITÉ PRO ASISTENTA:.*$/gim, "")
        .replace(/```[\s\S]*?```/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

// Byznysově kritické intenty se nesmí spoléhat na fuzzy skóre.
// Např. „kolik stojí Magnum…" jinak vytáhne seznam značek, protože slovo
// „Magnum" přebije cenový dotaz. Tyhle odpovědi jsou pevné.
const INTENT_OVERRIDES = [
    {
        test: /(nab[ií]z[ií]te|m[aá]te)\s+(financov|uver|úv[eě]r|spl[aá]tk)/i,
        answer: "Financování nabízíme přes **Moneta Auto** — až **100 %** ceny vozu, splácení až **84 měsíců**, vyřízení **na místě** v Uherském Brodě. Potřebujete **občanku** a **výpis z účtu**.\n\n"
              + "Více na [Financování](https://autoaws.cz/financovani/). Chcete spočítat konkrétní splátku k vozu? Napište mi, o jaké auto jde."
    },
    {
        test: /(obchodn[ií]\s+podm[ií]n|obchodne\s+podmien|terms\s+and\s+conditions|agb|podmínky\s+prodeje)/i,
        answer: "Na webu autoaws.cz není samostatná veřejná stránka Obchodní podmínky — konkrétní smluvní podmínky (kupní smlouva, záruka, reklamace) se řeší individuálně při koupi s prodejcem.\n\n"
              + "Obecné informace najdete zde:\n"
              + "- [Financování](https://autoaws.cz/financovani/)\n"
              + "- [Záruka Car Protect](https://autoaws.cz/zaruka/)\n"
              + "- [Pojištění](https://autoaws.cz/pojisteni/)\n"
              + "- [Kontakt](https://autoaws.cz/kontakt/)\n\n"
              + "Přesné znění k vaší koupi: +420 777 834 466 nebo info@autoaws.cz."
    },
    {
        test: /(jak\s+funguje\s+)?(doprav|doruč|doruc|platb|zaplat|převzet|prevzet|vyzvedn|hotovost)/i,
        answer: "Auto AWS je prodejce vozů, ne e-shop — **zásilková doprava se neuplatňuje**. Vůz si převezmete v showroomu v Uherském Brodě (Cihlářská 422, Havřice), ideálně po domluvě termínu.\n\n"
              + "**Platba:** financování na místě přes Moneta Auto (až 100 %, až 84 měsíců) — [Financování](https://autoaws.cz/financovani/). Další platební podmínky domluvíte s prodejcem při koupi.\n\n"
              + "Kontakt: +420 777 834 466, info@autoaws.cz, [Kontakt](https://autoaws.cz/kontakt/)."
    },
    {
        test: /(kde\s+(najdu|je)\s+kontakt|kontakt\s+na\s+auto\s*aws|jak\s+se\s+(s\s+v[aá]mi\s+)?spojit|telefon|e-?mail)/i,
        answer: "**Kontakt Auto AWS:**\n"
              + "- Telefon: **+420 777 834 466** (Vít Hauerland)\n"
              + "- E-mail: **info@autoaws.cz**\n"
              + "- Adresa: Cihlářská 422, Havřice, 688 01 Uherský Brod\n"
              + "- Otevřeno: Po–Pá 9:00–17:00, So 9:00–11:00\n\n"
              + "Více na [Kontakt](https://autoaws.cz/kontakt/)."
    },
    {
        test: /(chci\s+podat\s+reklamac|pod[aá]m\s+reklamac|reklamovat|reklamace|st[ií]žnost|stiznost|vada\s+na\s+voze)/i,
        answer: "Reklamace a práva z vadného plnění se řeší podle platné české legislativy a podmínek v kupní smlouvě. Konkrétní postup u vašeho vozu posoudí prodejce.\n\n"
              + "Kontaktujte nás: **+420 777 834 466** nebo **info@autoaws.cz**. Informace o záruce: [Záruka Car Protect](https://autoaws.cz/zaruka/)."
    },
    {
        test: /(gdpr|osobn[ií]\s+údaj[eě]?|osobni\s+udaj[e]?|zpracov[aá]n[ií]\s+údaj|ochran[aá]\s+údaj|soukrom[ií])/i,
        answer: "Zásady zpracování osobních údajů najdete na webu Auto AWS v sekci [Ochrana osobních údajů](https://autoaws.cz/zpracovani-osobnich-udaju/).\n\n"
              + "Správcem osobních údajů je provozovatel Auto AWS (Vít Hauerland), nikoli poskytovatel chatbota. Údaje slouží výhradně k vyřízení vašeho dotazu."
    },
    {
        test: /(m[aá]te\s+(nějak[eé]\s+)?(návody|navody|návod|navod|čl[aá]nky|clanky|čl[aá]nek|clanek|blog)|návody|navody|návod|navod|čl[aá]nky|clanky|čl[aá]nek|clanek|tipy|rady)/i,
        answer: "Na autoaws.cz není samostatný blog ani sekce Návody. Užitečné informace najdete v nabídce automobilů, financování, záruce a pojištění na webu autoaws.cz.\n\n"
              + "K dotazu k konkrétnímu vozu volejte +420 777 834 466 nebo pište na info@autoaws.cz."
    },
    {
        test: /(kdo\s+jste|o\s+firm[eě]|o\s+auto\s*aws|co\s+je\s+auto\s*aws|kdo\s+provozuje)/i,
        answer: "**Auto AWS** je prodejce koncernových automobilů v Uherském Brodě od roku 1998. Specializujeme se na prodej a dovoz vozů značek Audi, Volkswagen, Škoda, Seat a Cupra z Německa — ověřené autorizovaným servisem. V roce 2025 byl otevřen nový showroom.\n\n"
              + "Provozovatel: Vít Hauerland (IČO 69670811). Více: [autoaws.cz](https://autoaws.cz/) nebo [Kontakt](https://autoaws.cz/kontakt/)."
    },
    {
        test: /(akc[eě]|slev|výprodej|vyprodej|promo|kupon|levn[eě]ji|m[aá]te\s+slev)/i,
        answer: "Na webu autoaws.cz není veřejný seznam aktuálních akcí nebo slevových kódů.\n\n"
              + "U některých vozů je v nabídce **záruka zdarma** (program ADVANTAGE) — viz [Záruka](https://autoaws.cz/zaruka/). Konkrétní ceny jsou u každého vozu na [Nabídka automobilů](https://autoaws.cz/automobily/).\n\n"
              + "Individuální slevy ověřte u prodejce: +420 777 834 466 nebo info@autoaws.cz."
    },
    {
        test: /(kolik\s+(to\s+)?stoj|za\s+kolik|jak[aá]\s+je\s+cena|cena\s+(auta|vozu|automobilu)|cen[ií]k|price|how\s+much|preis)/i,
        answer: "Ceny konkrétních vozů jsou uvedeny u každého inzerátu na https://autoaws.cz/automobily/ — včetně ceny s DPH i bez DPH. "
              + "Pro aktuální cenu konkrétního vozu se podívejte do nabídky nebo zavolejte na +420 777 834 466 / info@autoaws.cz."
    },
    {
        test: /(skladem|na\s+sklad[eě]|dostupnost|m[aá]te\s+(je[sš]t[eě]\s+)?k\s+dispozici|in\s+stock|verf[uü]gbar)/i,
        answer: "Skladovou dostupnost konkrétního vozu nemám k dispozici — ověřte ji v aktuální nabídce na https://autoaws.cz/automobily/ "
              + "nebo zavolejte na +420 777 834 466 / info@autoaws.cz."
    }
];

function matchIntentOverride(message) {
    for (var oi = 0; oi < INTENT_OVERRIDES.length; oi++) {
        if (INTENT_OVERRIDES[oi].test.test(message || "")) return INTENT_OVERRIDES[oi].answer;
    }
    return null;
}

function answerFromKB(message) {
    if (!KB_SECTIONS.length) return matchIntentOverride(message);
    var intent = matchIntentOverride(message);
    if (intent) return intent;
    var ranked = rankSections(message).filter(function (r) {
        return !isInternalSection(r.sec.heading);
    });
    if (!ranked.length || ranked[0].score < 1.5) return null;
    var sec = ranked[0].sec;
    var raw = sec.body;
    var body = stripKbMeta(kbClean(raw));
    if (!body || body.length < 30) return null;

    // Sekce označené UNKNOWN nesmí odejít doslova — text „např. 24 měsíců"
    // by zákazník přečetl jako potvrzení. Nahradíme čistou eskalací.
    if (/UNKNOWN/.test(raw)) {
        return "Tuhle informaci nemám ověřenou, takže ji radši nebudu odhadovat. "
             + "Ověří vám ji kolegové na +420 777 834 466 nebo na info@autoaws.cz.";
    }
    if (body.length > 750) body = body.slice(0, 750).replace(/\s+\S*$/, "") + " …";

    // V degradovaném režimu (bez AI) připojíme kontakt, ať zákazník neskončí ve slepé uličce.
    if (!/777 834 466/.test(body)) {
        body += "\n\nKdyby něco nebylo jasné, ozvěte se na +420 777 834 466 nebo info@autoaws.cz.";
    }
    return body;
}

// Retrieval pro LLM: vyber jen relevantní sekce KB (místo celé 41 KB) → rychlejší + levnější.
// Vrátí "" když nic neskóruje (pak má model jádro faktů přímo v systémovém promptu).
function selectKB(message, maxChars) {
    maxChars = maxChars || 4000;
    if (!KB_SECTIONS.length) return "";
    var ranked = rankSections(message);
    if (!ranked.length) return "";
    var out = [], used = 0;
    for (var i = 0; i < ranked.length && used < maxChars; i++) {
        var sec = ranked[i].sec;
        var block = "## " + sec.heading + "\n" + kbClean(sec.body);
        if (used + block.length > maxChars) block = block.slice(0, maxChars - used);
        out.push(block);
        used += block.length;
    }
    return out.join("\n\n");
}

// ── Local knowledge base (fallback when no AI key) ──────
const LOCAL_KB = {
    cs: {
        greeting: "Dobrý den! Rád pomůžu – poradím s výběrem auta, financováním, zárukou, pojištěním, dopravou, platbou nebo kontaktem. S čím můžu posloužit?",
        shipping: "Auto AWS je prodejce vozů — zásilková doprava se neuplatňuje. Vůz si převezmete v showroomu v Uherském Brodě (Cihlářská 422), ideálně po domluvě termínu na +420 777 834 466. Více: https://autoaws.cz/kontakt/",
        payment: "Financování nabízíme přes Moneta Auto – až 100 % ceny vozu, splácení až 84 měsíců, vyřízení na místě (občanka + výpis z účtu). Další platební podmínky domluvíte při koupi. Více: https://autoaws.cz/financovani/",
        returns: "Reklamace a práva z vadného plnění se řeší podle zákona a kupní smlouvy. Kontaktujte prodejce na +420 777 834 466 nebo info@autoaws.cz. Informace o záruce: https://autoaws.cz/zaruka/",
        contact: "Zavolejte na +420 777 834 466 nebo napište na info@autoaws.cz. Provozovna: Cihlářská 422, Havřice, 688 01 Uherský Brod. Otevřeno Po–Pá 9–17, So 9–11. Více: https://autoaws.cz/kontakt/",
        terms: "Na webu není samostatná stránka Obchodní podmínky — smluvní podmínky se řeší při koupi. Obecné info: https://autoaws.cz/financovani/, https://autoaws.cz/zaruka/, https://autoaws.cz/kontakt/. Dotazy: +420 777 834 466.",
        gdpr: "Zásady zpracování osobních údajů: https://autoaws.cz/zpracovani-osobnich-udaju/. Správcem je provozovatel Auto AWS (Vít Hauerland), nikoli poskytovatel chatbota.",
        about: "Auto AWS prodává a dováží koncernové automobily (Audi, VW, Škoda, Seat, Cupra) z Německa od roku 1998. Showroom: Cihlářská 422, Uherský Brod. Více: https://autoaws.cz/kontakt/",
        articles: "Na webu není blog ani sekce Návody. Užitečné info: https://autoaws.cz/automobily/, https://autoaws.cz/financovani/, https://autoaws.cz/zaruka/. Dotazy: +420 777 834 466.",
        promo: "Veřejný seznam akcí na webu není. U některých vozů je záruka zdarma — https://autoaws.cz/zaruka/. Individuální slevy ověřte na +420 777 834 466.",
        warranty: "Prodloužená záruka Auto AWS Car Protect (DEFEND INSURANCE) — DELUXE, E-DELUXE, ADVANTAGE, až 3 roky. U některých vozů záruka zdarma. Více: https://autoaws.cz/zaruka/",
        cars: "Aktuální nabídka automobilů: https://autoaws.cz/automobily/ — Audi, VW, Škoda, Seat, Cupra dovezené z Německa, ověřené servisem.",
        thanks: "Není zač, rád jsem pomohl! Kdybyste potřebovali cokoli dalšího, jsem tu. 🙂",
        fallback: "Tím si nejsem úplně jistý, ale rád pomůžu s výběrem auta, financováním, zárukou, dopravou nebo kontaktem. Můžete se také obrátit na info@autoaws.cz."
    },
    sk: {
        greeting: "Dobrý deň! Rád pomôžem – poradím s dopravou, platbou, vrátením tovaru, reklamáciou alebo kontaktom. S čím môžem poslúžiť?",
        shipping: "Rozvážame po celej ČR alebo si tovar vyzdvihnete v sklade v Libiši (Po–Pi 8:00–16:30). Minimálna objednávka 1 200 Kč s DPH, doprava zadarmo od 4 000 Kč s DPH (do 30 kg); pod limit účtujeme 150 Kč s DPH. Rozvoz do 24 hodín.",
        payment: "Platiť možno v hotovosti pri odbere tovaru. Pri dlhodobej spolupráci je možná splatnosť na faktúru podľa individuálnej dohody – +420 777 834 466. Ceny sa zobrazia až po prihlásení.",
        returns: "Ak tovar dorazí poškodený a prepravný obal je celý, pripravte kvalitné fotky tovaru aj obalu – bez nich prepravca reklamáciu zamietne. Pošlite ich na info@autoaws.cz. Sme veľkoobchod pre podnikateľov, spotrebiteľské vrátenie do 14 dní sa neuplatní.",
        contact: "Zavolajte na +420 777 834 466 alebo napíšte na info@autoaws.cz. Veľkoobchod Po–Pi 8:00–16:30, maloobchod Po–Pi 8:00–18:00. Sklad: Mělnická 114, 277 11 Libiš.",
        terms: "Vaše údaje spracúva prevádzkovateľ Auto AWS ako správca osobných údajov (nie poskytovateľ chatbota), iba na vybavenie vašej otázky. Kompletné podmienky nájdete na webe autoaws.cz.",
        thanks: "Niet za čo, rád som pomohol! Ak by ste potrebovali čokoľvek ďalšie, som tu. 🙂",
        fallback: "Tým si nie som úplne istý, ale rád pomôžem s dopravou, platbou, vrátením, reklamáciou alebo kontaktom. Môžete sa tiež obrátiť na info@autoaws.cz."
    },
    en: {
        greeting: "Hello! Happy to help – I can advise on shipping, payment, returns, claims or contact. How can I help?",
        shipping: "We deliver across Czechia, or you can collect at our Libiš warehouse (Mon–Fri 8:00–16:30). Minimum order is CZK 1,200 incl. VAT; shipping is free from CZK 4,000 incl. VAT (up to 30 kg), otherwise CZK 150 incl. VAT. Delivery within 24 hours; orders placed before 12:30 arrive the next business day.",
        payment: "Payment is in cash on collection. For long-term partners, invoice payment terms can be arranged individually – call +420 777 834 466. Prices are visible only after logging into a wholesale account.",
        returns: "If goods arrive damaged while the shipping packaging is intact, take clear photos of both the goods and the packaging – without them the carrier will reject the claim. Send them promptly to info@autoaws.cz. Note: we are a wholesaler for businesses, so the consumer 14-day return does not apply.",
        contact: "Call +420 777 834 466 or email info@autoaws.cz. Wholesale is open Mon–Fri 8:00–16:30, retail Mon–Fri 8:00–18:00. Warehouse: Mělnická 114, 277 11 Libiš.",
        terms: "Your data is processed by the operator of the Auto AWS as the data controller (not the chatbot provider), solely to handle your query. Full terms are on the autoaws.cz.",
        thanks: "You're welcome, glad I could help! If you need anything else, I'm here. 🙂",
        fallback: "I'm not entirely sure about that, but I can help with shipping, payment, returns, claims or contact. You can also reach info@autoaws.cz."
    },
    de: {
        greeting: "Guten Tag! Gerne helfe ich – zu Versand, Zahlung, Rückgabe, Reklamation oder Kontakt. Womit kann ich helfen?",
        shipping: "Wir liefern tschechienweit, oder Sie holen die Ware im Lager Libiš ab (Mo–Fr 8:00–16:30). Mindestbestellwert 1.200 CZK inkl. MwSt., Versand ab 4.000 CZK inkl. MwSt. kostenlos (bis 30 kg), sonst 150 CZK inkl. MwSt. Lieferung binnen 24 Stunden.",
        payment: "Die Zahlung erfolgt bar bei Abholung. Für langfristige Partner ist ein Zahlungsziel nach individueller Vereinbarung möglich – +420 777 834 466. Preise sind erst nach Anmeldung sichtbar.",
        returns: "Kommt die Ware beschädigt an, während die Verpackung unversehrt ist, machen Sie bitte gute Fotos von Ware und Verpackung – ohne diese lehnt der Frachtführer die Reklamation ab. Senden Sie sie an info@autoaws.cz. Wir sind Großhandel für Unternehmen, das 14-tägige Verbraucherwiderrufsrecht gilt nicht.",
        contact: "Rufen Sie +420 777 834 466 an oder schreiben Sie an info@autoaws.cz. Großhandel Mo–Fr 8:00–16:30, Einzelhandel Mo–Fr 8:00–18:00. Lager: Mělnická 114, 277 11 Libiš.",
        terms: "Ihre Daten verarbeitet der Betreiber des Auto AWS als Verantwortlicher (nicht der Chatbot-Anbieter), nur zur Bearbeitung Ihrer Anfrage. Die vollständigen Bedingungen finden Sie auf autoaws.cz.",
        thanks: "Gern geschehen, ich helfe gerne! Wenn Sie noch etwas brauchen, bin ich da. 🙂",
        fallback: "Da bin ich mir nicht ganz sicher, aber ich helfe gerne zu Versand, Zahlung, Rückgabe, Reklamation oder Kontakt. Sie erreichen auch info@autoaws.cz."
    },
    fr: {
        greeting: "Bonjour ! Avec plaisir – je peux vous renseigner sur la livraison, le paiement, les retours, les réclamations ou le contact. Comment puis-je aider ?",
        shipping: "Nous livrons dans toute la Tchéquie, ou vous retirez la marchandise à l'entrepôt de Libiš (lun–ven 8h00–16h30). Commande minimale 1 200 CZK TTC, livraison gratuite à partir de 4 000 CZK TTC (jusqu'à 30 kg), sinon 150 CZK TTC. Livraison sous 24 heures.",
        payment: "Le paiement se fait en espèces à l'enlèvement. Pour les partenaires de longue date, un délai de paiement est possible par accord individuel – +420 777 834 466. Les prix ne sont visibles qu'après connexion.",
        returns: "Si la marchandise arrive endommagée alors que l'emballage est intact, prenez des photos nettes de la marchandise et de l'emballage – sans elles, le transporteur rejettera la réclamation. Envoyez-les à info@autoaws.cz. Nous sommes un grossiste pour professionnels : le retour consommateur sous 14 jours ne s'applique pas.",
        contact: "Appelez le +420 777 834 466 ou écrivez à info@autoaws.cz. Gros : lun–ven 8h00–16h30, détail : lun–ven 8h00–18h00. Entrepôt : Mělnická 114, 277 11 Libiš.",
        terms: "Vos données sont traitées par l'exploitant de la Auto AWS (responsable du traitement), uniquement pour traiter votre demande. Conditions complètes sur autoaws.cz.",
        thanks: "Avec plaisir, ravie d'avoir aidé ! Si vous avez besoin d'autre chose, je suis là. 🙂",
        fallback: "Je n'en suis pas tout à fait sûre, mais je peux aider pour la livraison, le paiement, les retours, les réclamations ou le contact. Vous pouvez aussi écrire à info@autoaws.cz."
    },
    es: {
        greeting: "¡Hola! Con gusto – puedo informarte sobre envío, pago, devoluciones, reclamaciones o contacto. ¿En qué ayudo?",
        shipping: "Entregamos en toda Chequia o puede recoger en el almacén de Libiš (lun–vie 8:00–16:30). Pedido mínimo 1.200 CZK con IVA, envío gratis desde 4.000 CZK con IVA (hasta 30 kg), si no 150 CZK con IVA. Entrega en 24 horas.",
        payment: "El pago se realiza en efectivo al recoger. Para socios a largo plazo es posible el pago a factura según acuerdo individual – +420 777 834 466. Los precios solo se ven tras iniciar sesión.",
        returns: "Si la mercancía llega dañada con el embalaje intacto, haga fotos nítidas del producto y del embalaje – sin ellas el transportista rechazará la reclamación. Envíelas a info@autoaws.cz. Somos mayorista para empresas: la devolución de 14 días del consumidor no aplica.",
        contact: "Llame al +420 777 834 466 o escriba a info@autoaws.cz. Mayorista lun–vie 8:00–16:30, minorista lun–vie 8:00–18:00. Almacén: Mělnická 114, 277 11 Libiš.",
        terms: "Tus datos los trata el operador de la tienda Auto AWS (responsable), solo para atender tu consulta. Condiciones completas en autoaws.cz.",
        thanks: "De nada, ¡encantada de ayudar! Si necesitas algo más, aquí estoy. 🙂",
        fallback: "No estoy del todo segura, pero puedo ayudar con envío, pago, devoluciones, reclamaciones o contacto. También puedes escribir a info@autoaws.cz."
    },
    it: {
        greeting: "Buongiorno! Volentieri – posso informarti su spedizione, pagamento, resi, reclami o contatti. Come posso aiutare?",
        shipping: "Consegniamo in tutta la Cechia oppure ritiri la merce al magazzino di Libiš (lun–ven 8:00–16:30). Ordine minimo 1.200 CZK IVA inclusa, spedizione gratuita da 4.000 CZK IVA inclusa (fino a 30 kg), altrimenti 150 CZK IVA inclusa. Consegna entro 24 ore.",
        payment: "Il pagamento avviene in contanti al ritiro. Per i partner di lungo periodo è possibile il pagamento a fattura secondo accordo individuale – +420 777 834 466. I prezzi sono visibili solo dopo l'accesso.",
        returns: "Se la merce arriva danneggiata con l'imballo integro, scatti foto nitide della merce e dell'imballo – senza di esse il corriere respingerà il reclamo. Le invii a info@autoaws.cz. Siamo un grossista per imprese: il reso consumatore di 14 giorni non si applica.",
        contact: "Chiami il +420 777 834 466 o scriva a info@autoaws.cz. Ingrosso lun–ven 8:00–16:30, dettaglio lun–ven 8:00–18:00. Magazzino: Mělnická 114, 277 11 Libiš.",
        terms: "I tuoi dati sono trattati dal gestore del negozio Auto AWS (titolare), solo per gestire la tua richiesta. Condizioni complete su autoaws.cz.",
        thanks: "Prego, felice di aver aiutato! Se ti serve altro, sono qui. 🙂",
        fallback: "Non ne sono del tutto sicura, ma posso aiutare con spedizione, pagamento, resi, reclami o contatti. Puoi anche scrivere a info@autoaws.cz."
    },
    pl: {
        greeting: "Dzień dobry! Chętnie pomogę – doradzę w sprawie dostawy, płatności, zwrotów, reklamacji lub kontaktu. W czym mogę pomóc?",
        shipping: "Dostarczamy w całych Czechach lub odbierzesz towar w magazynie w Libiši (pon–pt 8:00–16:30). Minimalne zamówienie 1 200 CZK z VAT, dostawa gratis od 4 000 CZK z VAT (do 30 kg), poniżej 150 CZK z VAT. Dostawa w ciągu 24 godzin.",
        payment: "Płatność gotówką przy odbiorze. Dla stałych partnerów możliwy termin płatności na fakturę wg indywidualnych ustaleń – +420 777 834 466. Ceny widoczne po zalogowaniu.",
        returns: "Jeśli towar dotrze uszkodzony, a opakowanie transportowe jest całe, zrób wyraźne zdjęcia towaru i opakowania – bez nich przewoźnik odrzuci reklamację. Wyślij je na info@autoaws.cz. Jesteśmy hurtownią dla firm, konsumencki zwrot w 14 dni nie obowiązuje.",
        contact: "Zadzwoń pod +420 777 834 466 lub napisz na info@autoaws.cz. Hurt pon–pt 8:00–16:30, detal pon–pt 8:00–18:00. Magazyn: Mělnická 114, 277 11 Libiš.",
        terms: "Twoje dane przetwarza operator Auto AWS (administrator), wyłącznie w celu obsługi zapytania. Pełny regulamin na autoaws.cz.",
        thanks: "Nie ma za co, miło że mogłam pomóc! Gdyby było coś jeszcze, jestem tutaj. 🙂",
        fallback: "Nie jestem do końca pewna, ale pomogę z dostawą, płatnością, zwrotami, reklamacjami lub kontaktem. Możesz też napisać na info@autoaws.cz."
    },
    uk: {
        greeting: "Доброго дня! Залюбки допоможу – підкажу щодо доставки, оплати, повернень, рекламацій чи контакту. Чим можу допомогти?",
        shipping: "Доставляємо по всій Чехії або заберете товар на складі в Лібіші (Пн–Пт 8:00–16:30). Мінімальне замовлення 1 200 Kč з ПДВ, доставка безкоштовна від 4 000 Kč з ПДВ (до 30 кг), інакше 150 Kč з ПДВ. Доставка протягом 24 годин.",
        payment: "Оплата готівкою при отриманні. Для довгострокових партнерів можлива відстрочка за індивідуальною домовленістю – +420 777 834 466. Ціни видно лише після входу.",
        returns: "Якщо товар прийшов пошкодженим, а транспортна упаковка ціла, зробіть якісні фото товару й упаковки – без них перевізник відхилить рекламацію. Надішліть на info@autoaws.cz. Ми — оптовик для підприємців, споживче повернення за 14 днів не діє.",
        contact: "Телефонуйте +420 777 834 466 або пишіть на info@autoaws.cz. Опт Пн–Пт 8:00–16:30, роздріб Пн–Пт 8:00–18:00. Склад: Mělnická 114, 277 11 Libiš.",
        terms: "Ваші дані обробляє оператор магазину Auto AWS (розпорядник), лише для опрацювання запиту. Повні умови на autoaws.cz.",
        thanks: "Будь ласка, рада була допомогти! Якщо потрібно ще щось — я тут. 🙂",
        fallback: "Не зовсім впевнена, але допоможу з доставкою, оплатою, поверненням, рекламацією чи контактом. Також можна написати на info@autoaws.cz."
    }
};

const KB_KEYWORDS = {
    greeting: ["ahoj", "dobrý den", "dobry den", "dobrý deň", "zdravím", "zdravim", "čau", "cau", "hello", "hi ", "hallo", "guten tag", "servus", "bonjour", "salut", "hola", "buongiorno", "ciao", "dzień dobry", "dzien dobry", "cześć", "czesc", "доброго дня", "привіт"],
    thanks:   ["děkuj", "dekuj", "díky", "diky", "ďakuj", "thank", "thx", "danke", "merci", "gracias", "grazie", "dziękuj", "dziekuj", "дякую"],
    shipping: ["doprav", "doruč", "doruc", "doruceni", "doručení", "převzet", "prevzet", "vyzvedn", "převzít", "prevzit", "showroom"],
    payment:  ["financ", "uver", "úvěr", "splatk", "splátk", "leasing", "moneta", "pujck", "půjč", "pay", "payment", "platb", "zaplat", "hotovost", "převod", "prevod"],
    returns:  ["reklamac", "reklam", "stížnost", "stiznost", "vada", "závada", "zavada"],
    contact:  ["kontakt", "telefon", "e-mail", "email", "spoji", "volat", "mail", "phone", "erreich", "support", "podpor", "télépho", "courriel", "contacto", "teléfono", "correo", "contatt", "telefono", "контакт", "пошт", "звʼяз", "зв'яз", "звяз"],
    terms:    ["podmín", "podmie", "obchodní podmín", "obchodne podmien", "terms", "condition", "smlouv", "smluv"],
    gdpr:     ["gdpr", "osobní údaj", "osobni udaj", "ochran", "soukrom", "privacy", "zpracování údaj", "zpracovani udaj"],
    about:    ["kdo jste", "o firm", "auto aws", "co prodáváte", "co prodavate", "provozovatel", "hauerland", "showroom"],
    articles: ["návod", "navod", "článek", "clanek", "blog", "tipy", "rady", "informace"],
    promo:    ["akce", "sleva", "slevy", "výprodej", "vyprodej", "promo", "kupon", "levněji", "levneji"],
    warranty: ["zaruk", "záruk", "car protect", "defend", "deluxe", "advantage", "pojist", "havarijn", "povinn", "garan", "warrant", "insur"],
    cars:     ["automobil", "auto", "vuz", "vozidlo", "nabidk", "nabídk", "skoda", "audi", "volkswagen", "seat", "cupra", "dovoz", "nemecko", "německo", "invent", "katalog"]
};

function matchCount(low, words) {
    let c = 0;
    for (const w of words) if (low.indexOf(w) !== -1) c++;
    return c;
}
// Pick the topic with the MOST keyword hits (not just the first match) → far fewer wrong answers.
// Greeting/thanks only when no real topic is detected; otherwise an honest fallback.
function answerLocally(message, lang) {
    const kb = LOCAL_KB[lang] || LOCAL_KB.cs;
    const low = (message || "").toLowerCase().trim();
    if (!low) return kb.fallback;

    const topics = ["shipping", "payment", "returns", "contact", "terms", "gdpr", "about", "articles", "promo", "warranty", "cars"];
    let best = null, bestScore = 0;
    for (const key of topics) {
        const s = matchCount(low, KB_KEYWORDS[key]);
        if (s > bestScore) { bestScore = s; best = key; }
    }
    if (bestScore > 0) return kb[best];
    if (matchCount(low, KB_KEYWORDS.thanks)) return kb.thanks;
    if (matchCount(low, KB_KEYWORDS.greeting)) return kb.greeting;
    return kb.fallback;   // don't guess — stay honest
}

const HAS_EUROUTER = !!EUROUTER_API_KEY && EUROUTER_API_KEY.startsWith("eur_");
const HAS_LLM = HAS_EUROUTER;

// Eurouter (Claude Sonnet) — OpenAI-compatible endpoint
// ── Ochrana latence: timeout, strop souběžnosti, cache ─────
// Bez timeoutu čekal request na LLM klidně 36 s. Radši rychlá přesná
// odpověď z báze než dlouhé ticho.
const LLM_TIMEOUT_MS   = parseInt(process.env.LLM_TIMEOUT_MS) || 12000;
const LLM_MAX_INFLIGHT = parseInt(process.env.LLM_MAX_INFLIGHT) || 16;
let llmInflight = 0;

// Cache odpovědí: většina návštěvníků se ptá na totéž (doprava, otevíračka…).
// Ušetří API kredity i latenci.
const CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_MS) || 3600000;
const CACHE_MAX = 500;
const replyCache = new Map();

function cacheKey(msg, lang) {
    return lang + "|" + deacc(msg).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
function cacheGet(key) {
    const hit = replyCache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.t > CACHE_TTL_MS) { replyCache.delete(key); return null; }
    return hit.v;
}
function cacheSet(key, value) {
    if (replyCache.size >= CACHE_MAX) {
        const oldest = replyCache.keys().next().value;
        if (oldest) replyCache.delete(oldest);
    }
    replyCache.set(key, { t: Date.now(), v: value });
}

async function callChatLLM(messages, maxTokens) {
    if (!HAS_EUROUTER) return null;
    try {
        const payload = { model: EUROUTER_MODEL, messages, max_tokens: maxTokens || 400, temperature: 0.4 };
        const ctl = new AbortController();
        const timer = setTimeout(function () { ctl.abort(); }, LLM_TIMEOUT_MS);
        let r;
        try {
            r = await fetch(EUROUTER_URL, {
                method: "POST",
                headers: { "Authorization": `Bearer ${EUROUTER_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: ctl.signal
            });
        } finally { clearTimeout(timer); }
        const d = await r.json();
        const txt = (d.choices && d.choices[0] && d.choices[0].message) ? d.choices[0].message.content : null;
        if (txt && txt.trim()) return txt.trim();
        console.error("Eurouter returned no content:", JSON.stringify(d).slice(0, 200));
    } catch (err) {
        STATS.aiFailures++;
        console.error(JSON.stringify({ evt: "llm_error", provider: "Eurouter", msg: err.message }));
    }
    return null;
}

// Streaming LLM call (OpenAI-compatible SSE). Same providers/order as callChatLLM.
// Calls onText(delta) for each token; returns the full text (or null on failure).
async function callChatLLMStream(messages, maxTokens, onText) {
    if (!HAS_EUROUTER) return null;
    try {
        const payload = { model: EUROUTER_MODEL, messages, max_tokens: maxTokens || 400, temperature: 0.4, stream: true };
        const r = await fetch(EUROUTER_URL, { method: "POST", headers: { "Authorization": `Bearer ${EUROUTER_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!r.ok || !r.body) { const errtxt = await r.text().catch(() => ""); console.error("Eurouter stream HTTP " + r.status + " " + errtxt.slice(0, 200)); return null; }
        let full = "", buf = "";
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let nl;
            while ((nl = buf.indexOf("\n")) !== -1) {
                const line = buf.slice(0, nl).trim();
                buf = buf.slice(nl + 1);
                if (line.indexOf("data:") !== 0) continue;
                const data = line.slice(5).trim();
                if (data === "[DONE]") { buf = ""; break; }
                try {
                    const j = JSON.parse(data);
                    const delta = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
                    if (delta) { full += delta; onText(delta); }
                } catch (e) { /* keepalive */ }
            }
        }
        if (full.trim()) return full.trim();
    } catch (err) { console.error("Eurouter stream error:", err.message); }
    return null;
}

// Shared instructions (used by both /chat and /chat-voice-stream so they never drift).
const LANG_INSTRUCTION = {
    cs: "Odpovídej v češtině.", sk: "Odpovídej ve slovenštině.", en: "Answer in English.",
    de: "Antworte auf Deutsch.", fr: "Réponds en français.", es: "Responde en español.",
    it: "Rispondi in italiano.", pl: "Odpowiadaj po polsku.", uk: "Відповідай українською."
};
const VOICE_MODE_INSTRUCTION = "REŽIM: hlasový (mluvené slovo). Piš PŘESNĚ tak, jak člověk MLUVÍ, ne jak píše: krátké věty, přirozený spád, vykání. MAXIMÁLNĚ 2 krátké věty. Žádné odrážky, URL, e-maily, čísla po číslicích ani zkratky hláskované po písmenech. Rytmus tvoř interpunkcí — čárka a tečka dělají přirozené mikropauzy, otazník zvedne intonaci, tři tečky… naznačí krátké zaváhání. NEPŘIDÁVEJ umělá výplňková slova (ehm, eee, hmm). Buď vřelý, klidný a sebejistý, ne přehnaně nadšený — jako zkušený člověk z firmy, ne call-centrum. Produkt zmiň JMÉNEM a krátce proč (např. „doporučil bych matraci DUOCELL, je tvrdší a pěkně drží záda\"), NEŘÍKEJ „podívejte se zde\". Pokud produkt doporučuješ, přidej ZA mluvené věty každý na SAMOSTATNÝ řádek jako markdown odkaz [Název produktu](URL z kontextu) – tyto řádky se nepřečtou, zobrazí se jako klikací tlačítka.";
const CHAT_MODE_INSTRUCTION = "REŽIM: textový chat. Buď stručný a přehledný; doporučené produkty uváděj jako markdown odkazy s názvem produktu jako textem odkazu.";

// ── Chat endpoint ───────────────────────────────────────
app.post("/chat", rateLimit, validateCsrf, async (req, res) => {
    const t0 = Date.now();
    STATS.chatRequests++;
    try {
        const { message, session_id, language, mode } = req.body;

        if (!message || typeof message !== "string") {
            return res.status(400).json({ error: "Chybí zpráva." });
        }

        if (message.length > MAX_MESSAGE_LENGTH) {
            return res.status(400).json({
                error: `Zpráva je příliš dlouhá (max ${MAX_MESSAGE_LENGTH} znaků).`
            });
        }

        const allowedLangs = ["cs", "sk", "en", "de", "fr", "es", "it", "pl", "uk"];
        const lang = allowedLangs.includes(language) ? language : "cs";

        const session = getOrCreateSession(session_id, req.body.history);
        session.messageCount++;

        if (session.messageCount > 50) {
            return res.status(429).json({
                error: "Překročen limit zpráv v této konverzaci."
            });
        }

        session.messages.push({ role: "user", content: message });

        if (session.messages.length > 20) {
            session.messages = session.messages.slice(-20);
        }

        const langInstruction = LANG_INSTRUCTION;
        const modeInstruction = (mode === "voice") ? VOICE_MODE_INSTRUCTION : CHAT_MODE_INSTRUCTION;

        let botReply = null;
        let servedFrom = "llm";

        // 1) Vícekrokové scénáře (výběr auta, financování) — má přednost před cache/LLM
        const scenOut = handleScenario(session, message);
        if (scenOut && scenOut.reply) {
            botReply = scenOut.reply;
            servedFrom = "scenario";
        }

        // 2) Cache: většina lidí se ptá na totéž. Platí jen pro první zprávu
        //    v konverzaci, aby se nezahodil kontext navazujících dotazů.
        const ck = cacheKey(message, lang);
        if (!botReply && session.messages.length <= 1) {
            const cached = cacheGet(ck);
            if (cached) { botReply = cached; servedFrom = "cache"; STATS.cacheHits++; }
        }

        // 3) Strop souběžnosti: když je LLM zahlcené, odpovíme rovnou z báze.
        //    Přesná odpověď za 5 ms je lepší než správná za 36 s.
        if (!botReply && HAS_LLM && llmInflight >= LLM_MAX_INFLIGHT) {
            const quick = matchIntentOverride(message) || answerFromKB(message);
            if (quick) { botReply = quick; servedFrom = "kb_overload"; STATS.kbOverload++; }
        }

        // 2.6) Kritické FAQ — deterministická odpověď bez LLM (obchodní podmínky, GDPR, reklamace…)
        if (!botReply) {
            const intentAns = matchIntentOverride(message);
            if (intentAns) { botReply = intentAns; servedFrom = "intent_override"; }
        }

        // Real AI when a key is configured (Gemini → Groq → OpenRouter).
        // Inject ONLY the KB sections relevant to the query (retrieval) → much faster + cheaper than the whole file.
        if (!botReply && HAS_LLM) {
            var recentUser = session.messages.filter(function (m) { return m.role === "user"; })
                .slice(-2).map(function (m) { return m.content; }).join(" ");
            // Voice mode: smaller KB context → faster first token (lower latency before the reply starts).
            const kb = HAS_KB ? selectKB(recentUser || message, mode === "voice" ? 2500 : 4000) : "";
            const prodCtx = productsContext(recentUser || message);
            const kbBlock = (kb || prodCtx)
                ? "\n\n=== ZNALOSTNÍ BÁZE (relevantní výňatky — autoritativní zdroj; odpovídej PŘEDNOSTNĚ z těchto dat; když tu odpověď není, řekni to a nasměruj na podporu) ===\n" + kb + prodCtx
                : "";
            llmInflight++;
            try {
                botReply = await callChatLLM([
                    { role: "system", content: SYSTEM_PROMPT + "\n\n" + langInstruction[lang] + "\n" + modeInstruction + kbBlock },
                    ...session.messages
                ], mode === "voice" ? 256 : 400);
            } finally { llmInflight--; }
        }

        // Fallback bez AI: nejdřív zkus vyhledat v KB, jinak vestavěná skórovaná báze
        if (!botReply) {
            botReply = answerFromKB(message) || answerLocally(message, lang);
            servedFrom = "kb_fallback";
        }

        const recommended_links = extractLinks(botReply);
        const cleanReply = cleanReplyText(botReply);
        session.messages.push({ role: "assistant", content: cleanReply });

        if (servedFrom === "llm" && session.messages.length <= 2) cacheSet(ck, botReply);

        const took = Date.now() - t0;
        STATS.latencyMsTotal += took;
        if (/nem\u00e1m ov\u011b\u0159en|neuv\u00e1d\u011bj\u00ed|neuv\u00e1d\u00ed|777 834 466/i.test(cleanReply)) STATS.unknownEscalations++;
        // Strukturovaný log (bez obsahu zprávy → neukládáme osobní údaje zákazníka)
        console.log(JSON.stringify({
            evt: "chat", lang: lang, ms: took, chars: message.length, src: servedFrom,
            reply: cleanReply.length, links: recommended_links.length,
            restored: !!session.restored, msgNo: session.messageCount
        }));

        res.json({
            response: cleanReply,
            session_id: session.id,
            recommended_links: recommended_links
        });

    } catch (err) {
        STATS.chatErrors++;
        console.error(JSON.stringify({ evt: "chat_error", msg: err && err.message, ms: Date.now() - t0 }));
        res.status(500).json({ error: "Interní chyba serveru." });
    }
});

// ── Voice streaming endpoint (SSE) ───────────────────────
// Streams the reply sentence-by-sentence so the client can START SPEAKING the first
// sentence while the rest is still being generated (lower perceived latency, same answers).
// Events: {t:"start",session_id} · {t:"say",s:"<spoken sentence>"} · {t:"done",links,text} · {t:"error"}
app.post("/chat-voice-stream", rateLimit, validateCsrf, async (req, res) => {
    const { message, session_id, language } = req.body || {};
    if (!message || typeof message !== "string") return res.status(400).json({ error: "Chybí zpráva." });
    if (message.length > MAX_MESSAGE_LENGTH) return res.status(400).json({ error: "Zpráva je příliš dlouhá." });
    if (!HAS_LLM) return res.status(503).json({ error: "Streaming není dostupný." });   // → client falls back to /chat
    const allowedLangs = ["cs", "sk", "en", "de", "fr", "es", "it", "pl", "uk"];
    const lang = allowedLangs.includes(language) ? language : "cs";
    const session = getOrCreateSession(session_id);
    session.messageCount++;
    if (session.messageCount > 50) return res.status(429).json({ error: "Překročen limit zpráv v této konverzaci." });

    session.messages.push({ role: "user", content: message });
    if (session.messages.length > 20) session.messages = session.messages.slice(-20);

    res.set({
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
    });
    if (res.flushHeaders) res.flushHeaders();
    let closed = false;
    // NOTE: use res "close" (client disconnected / response done), NOT req "close" — in modern Node
    // req "close" fires as soon as the request BODY is read, which would suppress all our SSE writes.
    res.on("close", function () { closed = true; });
    const send = function (obj) { if (!closed) { try { res.write("data: " + JSON.stringify(obj) + "\n\n"); } catch (e) {} } };
    send({ t: "start", session_id: session.id });

    const recentUser = session.messages.filter(function (m) { return m.role === "user"; }).slice(-2).map(function (m) { return m.content; }).join(" ");
    const kb = HAS_KB ? selectKB(recentUser || message, 2500) : "";
    const kbBlock = kb
        ? "\n\n=== ZNALOSTNÍ BÁZE (relevantní výňatky — autoritativní zdroj; odpovídej PŘEDNOSTNĚ z těchto dat; když tu odpověď není, řekni to a nasměruj na podporu) ===\n" + kb
        : "";
    const msgs = [{ role: "system", content: SYSTEM_PROMPT + "\n\n" + LANG_INSTRUCTION[lang] + "\n" + VOICE_MODE_INSTRUCTION + kbBlock }, ...session.messages];

    let full = "", firstSpoken = "", firstSent = false;
    try {
        await callChatLLMStream(msgs, 256, function (delta) {
            full += delta;
            if (firstSent || closed) return;
            // Emit the first complete sentence as soon as it lands (terminator + trailing whitespace).
            const spoken = spokenOnly(full);
            const m = spoken.match(/^\s*([\s\S]+?[.!?…])\s/);
            if (m && m[1].trim()) { firstSpoken = m[1].trim(); firstSent = true; send({ t: "say", s: firstSpoken }); }
        });
    } catch (e) { /* fall through to fallback signal below */ }

    if (!full || !full.trim()) {
        // streaming brain produced nothing → undo the user push and tell the client to fall back to /chat
        if (session.messages.length && session.messages[session.messages.length - 1].role === "user") session.messages.pop();
        send({ t: "error" });
        return res.end();
    }

    const spokenFull = spokenOnly(full);
    if (!firstSent) {
        if (spokenFull) send({ t: "say", s: spokenFull });
    } else {
        const i = spokenFull.indexOf(firstSpoken);
        const rest = (i !== -1 ? spokenFull.slice(i + firstSpoken.length) : "").trim();
        if (rest) send({ t: "say", s: rest });
    }
    session.messages.push({ role: "assistant", content: spokenFull });
    send({ t: "done", links: extractLinks(full), text: spokenFull });
    res.end();
});

// Derive a readable product title from an autoaws.cz URL slug (fallback when label is generic)
function titleFromUrl(u) {
    try {
        var seg = u.split("?")[0].replace(/\/+$/, "").split("/").pop() || "";
        seg = decodeURIComponent(seg).replace(/[-_]+/g, " ").trim();
        if (!seg || /\.(pdf|html?)$/i.test(seg)) return "Auto AWS";
        return seg.charAt(0).toUpperCase() + seg.slice(1);
    } catch (e) { return "Auto AWS"; }
}

// Pull product/category links out of the LLM reply → clickable buttons {title, url}
const GENERIC_LABEL = /^(odkaz|odkaz zde|zde|tady|sem|klikni|klikněte|klikni zde|více|vice|here|link|tento odkaz|název produktu|nazev produktu|produkt|product name|product|zobrazit produkt)$/i;
function extractLinks(text) {
    if (!text) return [];
    var out = [], seen = {};
    var re = /\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, m;
    while ((m = re.exec(text)) && out.length < 3) {
        var url = m[2].replace(/[.,;]+$/, "");
        if (seen[url]) continue; seen[url] = 1;
        if (!isKnownUrl(url)) continue;   // vymyšlené URL zahodíme
        var label = (m[1] || "").replace(/[*_`#]/g, "").trim();
        if (!label || GENERIC_LABEL.test(label)) label = titleFromUrl(url);
        out.push({ title: label, url: url });
    }
    if (out.length < 3) {
        var re2 = /(https?:\/\/(?:www\.)?autoaws\.cz[^\s)\]]*)/gi, b;
        while ((b = re2.exec(text)) && out.length < 3) {
            var u = b[1].replace(/[.,;]+$/, "");
            if (seen[u]) continue; seen[u] = 1;
            if (!isKnownUrl(u)) continue;   // vymyšlené URL zahodíme
            out.push({ title: titleFromUrl(u), url: u });
        }
    }
    return out;
}

// Strip markdown links / bare URLs / markdown syntax → clean text for the bubble + voice + TTS
function cleanReplyText(text) {
    if (!text) return text;
    return text
        // remove the whole "intro line ending with ':' + following product-link lines" block at once
        // (links become clickable buttons; the colon intro is only removed when links actually follow it)
        .replace(/(?:^[^\n]*:[ \t]*$\n+)?(?:^[ \t]*(?:[-*•]|\d+[.)])?[ \t]*\[[^\]]*\]\((?:https?:\/\/[^\s)]+)\)[ \t]*$\n*)+/gm, "\n")
        .replace(/\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, "$1") // any remaining inline [label](url) → label
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")                    // [label](cokoliv jiného) → label (placeholdery)
        .replace(/https?:\/\/[^\s)\]]+/g, "")                    // bare URLs → gone
        .replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/^#{1,6}\s*/gm, "")
        .replace(/\(\s*\)/g, "")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/ +([.,;:!?])/g, "$1")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

// SPOKEN text only (for TTS/streaming): cut everything from the first product link onward
// (links always come AFTER the spoken sentences), then clean markdown + drop a dangling "Intro:" line.
// Guarantees a product label/URL is never read aloud, regardless of how the model formats links.
function spokenOnly(text) {
    if (!text) return "";
    var i = text.search(/\[[^\]]*\]\(https?:\/\//);   // first markdown link [label](http…)
    var t = (i >= 0) ? text.slice(0, i) : text;
    t = cleanReplyText(t);
    t = t.replace(/\n+[^\n.!?…]*:\s*$/, "").trim();   // remove a trailing "Doporučené produkty:" style intro with no link left
    return t;
}

// Číslo 0–999 → česká slova
function czNumUnder1000(n) {
    var ones = ["", "jedna", "dva", "tři", "čtyři", "pět", "šest", "sedm", "osm", "devět", "deset", "jedenáct", "dvanáct", "třináct", "čtrnáct", "patnáct", "šestnáct", "sedmnáct", "osmnáct", "devatenáct"];
    var tens = ["", "", "dvacet", "třicet", "čtyřicet", "padesát", "šedesát", "sedmdesát", "osmdesát", "devadesát"];
    var hundreds = ["", "sto", "dvě stě", "tři sta", "čtyři sta", "pět set", "šest set", "sedm set", "osm set", "devět set"];
    var out = [], h = Math.floor(n / 100); n %= 100;
    if (h) out.push(hundreds[h]);
    if (n < 20) { if (n) out.push(ones[n]); }
    else { out.push(tens[Math.floor(n / 10)]); if (n % 10) out.push(ones[n % 10]); }
    return out.join(" ");
}
// Celé číslo 0–999999 → česká slova (kvůli správné výslovnosti TTS)
function czNum(n) {
    n = parseInt(n, 10);
    if (isNaN(n)) return "";
    if (n === 0) return "nula";
    var out = [], th = Math.floor(n / 1000), rest = n % 1000;
    if (th) {
        if (th === 1) out.push("tisíc");
        else if (th >= 2 && th <= 4) out.push(czNumUnder1000(th) + " tisíce");
        else out.push(czNumUnder1000(th) + " tisíc");
    }
    if (rest) out.push(czNumUnder1000(rest));
    return out.join(" ").replace(/\s+/g, " ").trim();
}

// Expand abbreviations + numbers so the voice reads them as Czech words, not letter-by-letter / in English
function ttsNormalize(text) {
    return text
        // defensive: never let the voice read markdown/URLs even if upstream changes
        .replace(/\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, "$1")
        .replace(/https?:\/\/[^\s)\]]+/g, "")
        .replace(/[*_`#>]/g, "")
        .replace(/po celé ČR/g, "po celé České republice")
        .replace(/ČR/g, "Česká republika")
        .replace(/\bSR\b/g, "Slovenská republika")
        .replace(/(\d)\s*Kč/g, "$1 korun").replace(/Kč/g, "korun")
        .replace(/(\d)\s*%/g, "$1 procent")
        // čísla → česká slova (1,5 → "jedna celá pět"; 9990 → "devět tisíc devět set devadesát"; dlouhé sekvence po číslicích)
        .replace(/\d+(?:[.,]\d+)?/g, function (m) {
            if (/[.,]/.test(m)) { var p = m.split(/[.,]/); return czNum(p[0]) + " celá " + czNum(p[1]); }
            if (m.length > 6) return m.split("").map(function (d) { return czNum(d); }).join(" ");
            return czNum(m);
        })
        .replace(/@/g, " zavináč ")
        .replace(/\s+/g, " ")
        .trim();
}

// Auto-pick the most realistic Google voice for a language (Chirp3-HD > Wavenet > Neural2 > Standard, female).
async function pickGoogleVoice(langCode) {
    if (GOOGLE_TTS_VOICE) return GOOGLE_TTS_VOICE;
    if (PREFERRED_GOOGLE_VOICE[langCode]) return PREFERRED_GOOGLE_VOICE[langCode];
    if (_googleVoiceCache[langCode]) return _googleVoiceCache[langCode];
    try {
        const r = await fetch("https://texttospeech.googleapis.com/v1/voices?languageCode="
            + encodeURIComponent(langCode) + "&key=" + encodeURIComponent(GOOGLE_TTS_API_KEY));
        const d = await r.json();
        const voices = (d && d.voices) || [];
        var score = function (v) {
            var n = v.name || "";
            var tier = /Chirp3-HD/i.test(n) ? 4 : /Wavenet/i.test(n) ? 3 : /Neural2/i.test(n) ? 2 : /Studio/i.test(n) ? 2 : 1;
            var fem = (v.ssmlGender === "FEMALE") ? 0.5 : 0;
            return tier + fem;
        };
        voices.sort(function (a, b) { return score(b) - score(a); });
        var chosen = voices.length ? voices[0].name : null;
        if (chosen) _googleVoiceCache[langCode] = chosen;
        return chosen;
    } catch (e) {
        console.error("Google voices list error:", e && e.message);
        return null;
    }
}

async function synthesizeGoogle(text, lang, voiceOverride) {
    const langCode = GOOGLE_LANG[lang] || "cs-CZ";
    const voiceName = voiceOverride || await pickGoogleVoice(langCode);
    const body = {
        input: { text: text },
        voice: voiceName ? { languageCode: langCode, name: voiceName } : { languageCode: langCode },
        // LINEAR16 (WAV) = lossless → crisp, no muffled MP3 compression
        audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: 24000, speakingRate: GOOGLE_SPEED }
    };
    const r = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize?key="
        + encodeURIComponent(GOOGLE_TTS_API_KEY), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    const d = await r.json();
    if (!r.ok || !d.audioContent) {
        throw new Error("Google TTS " + r.status + " " + JSON.stringify(d.error || d).slice(0, 200));
    }
    return Buffer.from(d.audioContent, "base64");
}

async function synthesizeEleven(text, lang) {
    const url = "https://api.elevenlabs.io/v1/text-to-speech/"
        + encodeURIComponent(ELEVENLABS_VOICE_ID) + "?output_format=mp3_44100_128";
    const body = {
        text: text,
        model_id: ELEVENLABS_MODEL,
        // Researched natural-conversation settings for realtime: mid stability (human but stable;
        // <0.4 risks artifacts/mispronunciation in Czech), similarity 0.75 (identity without the
        // over-enunciated "news anchor" effect), style 0 (style>0 adds latency + instability live),
        // speaker boost on, natural speed.
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true, speed: 1.0 },
        // We already convert digits → correct Czech words server-side (ttsNormalize/czNum), so turn
        // off ElevenLabs' English-centric normalizer (it mangles Czech declension and adds latency).
        apply_text_normalization: "off"
    };
    // flash/turbo accept language_code to lock the language → fewer mispronunciations (multilingual_v2 auto-detects).
    if (lang && /flash|turbo/i.test(ELEVENLABS_MODEL)) body.language_code = lang;
    const r = await fetch(url, {
        method: "POST",
        headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json", "Accept": "audio/mpeg" },
        body: JSON.stringify(body)
    });
    if (!r.ok) {
        const detail = await r.text().catch(() => "");
        throw new Error("ElevenLabs " + r.status + " " + detail.slice(0, 200));
    }
    return Buffer.from(await r.arrayBuffer());
}

// ── TTS proxy: Google Cloud (native, most realistic) → ElevenLabs fallback ──
app.post("/tts", rateLimit, validateCsrf, async (req, res) => {
    try {
        if (!HAS_TTS) {
            return res.status(503).json({ error: "TTS není nakonfigurováno." });
        }
        const { text, language, voice } = req.body;
        if (!text || typeof text !== "string") {
            return res.status(400).json({ error: "Chybí text." });
        }
        if (ttsBudgetLeft() <= 0) {
            console.warn(JSON.stringify({ evt: "tts_budget_exhausted", day: budgetState.day }));
            return res.status(503).json({ error: "Hlasový režim je dočasně nedostupný." });
        }
        const lang = GOOGLE_LANG[language] ? language : "cs";
        const input = ttsNormalize(text.slice(0, MAX_TTS_LENGTH));
        budgetState.ttsChars += input.length;
        STATS.ttsRequests++; STATS.ttsChars += input.length;
        // optional voice override (voice tester) — strict format guard
        const voiceOverride = (typeof voice === "string" && /^[a-zA-Z]{2}-[A-Z]{2}-[A-Za-z0-9\-]+$/.test(voice)) ? voice : null;

        let buf = null;
        let contentType = "audio/mpeg";
        var tryGoogle = async function () {
            if (buf || !HAS_GOOGLE_TTS) return;
            try { buf = await synthesizeGoogle(input, lang, voiceOverride); contentType = "audio/wav"; }
            catch (e) { console.error("Google TTS error:", e && e.message); }
        };
        var tryEleven = async function () {
            if (buf || !HAS_ELEVEN) return;
            try { buf = await synthesizeEleven(input, lang); contentType = "audio/mpeg"; }
            catch (e) { console.error("ElevenLabs TTS error:", e && e.message); }
        };
        // TTS_PRIMARY = "elevenlabs" → ElevenLabs (Hanka) first; jinak Google first
        if (TTS_PRIMARY === "elevenlabs") { await tryEleven(); await tryGoogle(); }
        else { await tryGoogle(); await tryEleven(); }
        if (!buf || !buf.length) {
            return res.status(502).json({ error: "TTS se nezdařilo." });
        }
        res.set("Content-Type", contentType);
        res.set("Cache-Control", "no-store");
        res.send(buf);
    } catch (err) {
        console.error("TTS error:", err && err.message);
        res.status(500).json({ error: "Interní chyba TTS." });
    }
});

// ── Speech-to-Text (ElevenLabs Scribe) — reliable cross-browser voice input ──
// Browser records audio (MediaRecorder, works on Chrome/Safari/iOS/Firefox) → here → transcript.
const STT_LANG = { cs: "cs", sk: "sk", en: "en", de: "de", fr: "fr", es: "es", it: "it", pl: "pl", uk: "uk" };

app.post("/stt", rateLimit, validateCsrf, express.raw({ type: () => true, limit: "12mb" }), async (req, res) => {
    try {
        if (!HAS_ELEVEN) return res.status(503).json({ error: "Přepis řeči není nastaven." });
        if (sttBudgetLeft() <= 0) {
            console.warn(JSON.stringify({ evt: "stt_budget_exhausted", day: budgetState.day }));
            return res.status(503).json({ error: "Hlasový vstup je dočasně nedostupný." });
        }
        const audio = req.body;
        if (!audio || !audio.length) return res.status(400).json({ error: "Chybí audio." });
        budgetState.sttReqs++; STATS.sttRequests++;
        const lang = STT_LANG[req.query.lang] || "cs";
        const mime = (req.headers["content-type"] || "audio/webm").split(";")[0];
        const ext = mime.indexOf("mp4") !== -1 ? "mp4"
            : mime.indexOf("mpeg") !== -1 ? "mp3"
            : mime.indexOf("wav") !== -1 ? "wav"
            : mime.indexOf("ogg") !== -1 ? "ogg" : "webm";

        const fd = new FormData();
        fd.append("file", new Blob([audio], { type: mime }), "audio." + ext);
        fd.append("model_id", "scribe_v1");
        fd.append("diarize", "false");
        fd.append("tag_audio_events", "false");
        fd.append("language_code", lang);

        const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
            method: "POST",
            headers: { "xi-api-key": ELEVENLABS_API_KEY },
            body: fd
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
            console.error("STT error:", r.status, JSON.stringify(d).slice(0, 200));
            return res.status(502).json({ error: "Přepis se nezdařil." });
        }
        res.json({ text: ((d && d.text) || "").trim() });
    } catch (err) {
        console.error("STT exception:", err && err.message);
        res.status(500).json({ error: "Interní chyba přepisu." });
    }
});

// ── Health check ────────────────────────────────────────
app.get(["/api/health", "/health"], (req, res) => {
    rollBudgetDay();
    const up = Date.now() - STATS.startedAt;
    const avgMs = STATS.chatRequests ? Math.round(STATS.latencyMsTotal / STATS.chatRequests) : 0;
    res.json({
        status: "ok",
        service: "autoaws-chatbot",
        llm: { configured: HAS_LLM, provider: HAS_EUROUTER ? "eurouter" : null, model: HAS_EUROUTER ? EUROUTER_MODEL : null },
        uptimeSec: Math.round(up / 1000),
        kb: { sections: KB_SECTIONS.length, bytes: KB_TEXT.length, urls: KB_URLS.size },
        sessions: sessions.size,
        traffic: {
            chatRequests: STATS.chatRequests,
            chatErrors: STATS.chatErrors,
            aiFailures: STATS.aiFailures,
            rateLimited: STATS.rateLimited,
            sessionsRestored: STATS.sessionsRestored,
            cacheHits: STATS.cacheHits,
            cacheSize: replyCache.size,
            kbOverloadFallbacks: STATS.kbOverload,
            llmInflight: llmInflight,
            avgLatencyMs: avgMs
        },
        budget: {
            day: budgetState.day,
            ttsCharsUsed: budgetState.ttsChars,
            ttsCharsLeft: Math.max(0, ttsBudgetLeft()),
            sttReqsUsed: budgetState.sttReqs,
            sttReqsLeft: Math.max(0, sttBudgetLeft())
        }
    });
});

// ── Start ───────────────────────────────────────────────
// On Vercel (serverless) we export the app instead of listening on a port.
if (process.env.VERCEL) {
    module.exports = app;
} else {
    app.listen(PORT, () => {
    console.log(`Auto AWS Chatbot server běží na http://localhost:${PORT}`);
    console.log(HAS_KB
        ? `Znalostní báze: autoaws-kb.md (${KB_SECTIONS.length} sekcí, ${(KB_TEXT.length/1024).toFixed(0)} KB) — aktivní`
        : "Znalostní báze: NENAČTENA (knowledge/autoaws-kb.md chybí).");
    if (HAS_EUROUTER) {
        console.log(`AI režim: Eurouter (${EUROUTER_MODEL}) — odpovídá ze znalostní báze`);
    } else {
        console.log("AI nenastaveno → běží vyhledávání v KB / vestavěná báze. Nastav EUROUTER_API_KEY v .env.");
    }
    if (HAS_GOOGLE_TTS) {
        console.log("Hlas: Google Cloud TTS (rodilá čeština, auto-výběr Chirp3-HD/WaveNet)" + (HAS_ELEVEN ? " + ElevenLabs fallback" : ""));
    } else if (HAS_ELEVEN) {
        console.log(`Hlas: ElevenLabs (${ELEVENLABS_MODEL}, voice ${ELEVENLABS_VOICE_ID}). Pro rodilou češtinu doplň GOOGLE_TTS_API_KEY do .env.`);
    } else {
        console.log("Hlas: nenastaven žádný TTS klíč.");
    }
    });
}
