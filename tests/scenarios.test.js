#!/usr/bin/env node
/**
 * Test vícekrokových scénářů (výběr auta, financování)
 * Spuštění: node tests/scenarios.test.js [base-url]
 */

const BASE = process.argv[2] || "http://localhost:3000";

async function getCsrf() {
    const r = await fetch(BASE + "/api/csrf-token");
    return (await r.json()).token;
}

async function chat(message, sessionId, lang) {
    const token = await getCsrf();
    const r = await fetch(BASE + "/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
        body: JSON.stringify({ message: message, session_id: sessionId, language: lang || "cs" })
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
}

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

(async () => {
    console.log("Scénáře test @ " + BASE);
    let passed = 0, failed = 0;

    // ── Scénář 1: výběr auta ──
    try {
        let sid = null;
        let d = await chat("Hledám auto do 500 tisíc", sid);
        sid = d.session_id;
        assert(/palivo|benzín|diesel|elektro/i.test(d.response), "krok1: měl se zeptat na palivo");
        assert(!/e-up|passat/i.test(d.response), "krok1: ještě nemá doporučovat");

        d = await chat("Elektro", sid);
        assert(/typ|město|suv|kombi/i.test(d.response), "krok2: měl se zeptat na typ");

        d = await chat("Do města", sid);
        assert(/značk|vw|škoda|jedno/i.test(d.response), "krok3: měl se zeptat na značku");

        d = await chat("VW", sid);
        assert(/e-up|379/i.test(d.response), "krok4: měl doporučit e-up");
        assert(d.recommended_links && d.recommended_links.length >= 1, "krok4: měl vrátit odkaz");
        console.log("OK  car-finder (4 kroky)");
        passed++;
    } catch (e) {
        console.log("FAIL car-finder", e.message);
        failed++;
    }

    // ── Scénář 2: financování ──
    try {
        let sid = null;
        let d = await chat("Zajímá mě financování auta", sid);
        sid = d.session_id;
        assert(/vůz|cenov|relac|passat|tisíc/i.test(d.response), "fin1: měl se zeptat na vůz/cenu");

        d = await chat("Passat kolem 450 tisíc", sid);
        assert(/akontac|100\s*%/i.test(d.response), "fin2: měl se zeptat na akontaci");

        d = await chat("Bez akontace, co nejvíc", sid);
        assert(/splátk|splacen|měsíční/i.test(d.response), "fin3: měl se zeptat na splátky");

        d = await chat("Nižší splátka", sid);
        assert(/moneta/i.test(d.response), "fin4: měl zmínit Moneta");
        assert(/84|100\s*%/i.test(d.response), "fin4: měl zmínit podmínky");
        assert(d.recommended_links && d.recommended_links.some(function (l) {
            return l.url && l.url.indexOf("financovani") !== -1;
        }), "fin4: měl vrátit odkaz na financování");
        console.log("OK  financing (4 kroky)");
        passed++;
    } catch (e) {
        console.log("FAIL financing", e.message);
        failed++;
    }

    console.log("\n" + passed + "/2 passed");
    process.exit(failed > 0 ? 1 : 0);
})();
