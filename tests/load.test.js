#!/usr/bin/env node
/**
 * TENESCO Asistent — zátěžový test
 *
 * Spuštění:  node tests/load.test.js [base-url] [souběžných] [požadavků celkem]
 * Příklad:   node tests/load.test.js http://localhost:3000 20 200
 *
 * Simuluje souběžné návštěvníky s vlastní session a měří latenci,
 * chybovost a chování rate limitu.
 */

const BASE = process.argv[2] || "http://localhost:3000";
const CONCURRENCY = parseInt(process.argv[3]) || 20;
const TOTAL = parseInt(process.argv[4]) || 200;

const QUESTIONS = [
    "od kolika je doprava zdarma?",
    "kdy máte otevřeno?",
    "můžu nakoupit bez IČO?",
    "jak se s vámi spojím?",
    "jaká je minimální objednávka?",
    "jaké značky vedete?",
    "jak rychle dorazí zboží?",
    "zboží dorazilo poškozené"
];

async function getToken() {
    try {
        const r = await fetch(BASE + "/api/csrf-token");
        return (await r.json()).token;
    } catch (e) { return null; }
}

const results = { ok: 0, rateLimited: 0, errors: 0, latencies: [], codes: {} };

async function oneRequest(token, i) {
    const q = QUESTIONS[i % QUESTIONS.length];
    const t0 = Date.now();
    try {
        const r = await fetch(BASE + "/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRF-Token": token || "" },
            body: JSON.stringify({ message: q, language: "cs", mode: "chat" })
        });
        const ms = Date.now() - t0;
        results.codes[r.status] = (results.codes[r.status] || 0) + 1;
        if (r.status === 429) { results.rateLimited++; return; }
        if (!r.ok) { results.errors++; return; }
        const d = await r.json();
        if (d.response && d.response.length > 0) {
            results.ok++;
            results.latencies.push(ms);
        } else {
            results.errors++;
        }
    } catch (e) {
        results.errors++;
        results.codes["net"] = (results.codes["net"] || 0) + 1;
    }
}

function pct(arr, p) {
    if (!arr.length) return 0;
    const s = arr.slice().sort(function (a, b) { return a - b; });
    return s[Math.min(s.length - 1, Math.floor(s.length * p))];
}

(async function main() {
    const token = await getToken();
    console.log("Zátěžový test");
    console.log("cíl: " + BASE + "  |  souběžně: " + CONCURRENCY + "  |  celkem: " + TOTAL + "\n");

    const t0 = Date.now();
    let issued = 0;
    async function worker() {
        while (issued < TOTAL) {
            const i = issued++;
            await oneRequest(token, i);
        }
    }
    const workers = [];
    for (let i = 0; i < CONCURRENCY; i++) workers.push(worker());
    await Promise.all(workers);
    const total = (Date.now() - t0) / 1000;

    console.log("doba běhu:      " + total.toFixed(1) + " s");
    console.log("propustnost:    " + (TOTAL / total).toFixed(1) + " req/s");
    console.log("úspěšné:        " + results.ok);
    console.log("rate-limited:   " + results.rateLimited + " (429 — očekávané, chrání API kredity)");
    console.log("chyby:          " + results.errors);
    console.log("HTTP kódy:      " + JSON.stringify(results.codes));
    if (results.latencies.length) {
        console.log("\nlatence úspěšných odpovědí:");
        console.log("  medián: " + pct(results.latencies, 0.5) + " ms");
        console.log("  p90:    " + pct(results.latencies, 0.9) + " ms");
        console.log("  p99:    " + pct(results.latencies, 0.99) + " ms");
        console.log("  max:    " + Math.max.apply(null, results.latencies) + " ms");
    }

    try {
        const h = await (await fetch(BASE + "/api/health")).json();
        console.log("\n/health po testu:");
        console.log("  sessions:      " + h.sessions);
        console.log("  chatRequests:  " + h.traffic.chatRequests);
        console.log("  chatErrors:    " + h.traffic.chatErrors);
        console.log("  rateLimited:   " + h.traffic.rateLimited);
        console.log("  avgLatencyMs:  " + h.traffic.avgLatencyMs);
    } catch (e) { /* health nedostupný */ }

    console.log("\nPozn.: 429 není chyba testu. Rate limit je nastavený na "
        + "RATE_LIMIT_MAX požadavků na IP za minutu a tady jde všechno z jedné IP.");
    process.exit(results.errors > TOTAL * 0.02 ? 1 : 0);
})();
