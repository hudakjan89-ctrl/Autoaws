/* ============================================================
   Auto AWS Asistent – chat.js (v2.3)
   Prodej koncernových automobilů
   ============================================================ */

(function () {
    "use strict";

    // ── Config ──────────────────────────────────────────────
    const BASE_URL = document.querySelector("[data-base-url]")
        ? document.querySelector("[data-base-url]").getAttribute("data-base-url")
        : "";

    const BOT_IMG = "img/bot.svg";

    // ── Quick-action icons (inline SVG, stroke = currentColor) ──
    const QA_ICONS = {
        contact:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
        shipping: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
        returns:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
        terms:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
        gdpr:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
        about:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
        articles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
        promo:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
        food:     '<svg viewBox="0 0 24 24" fill="currentColor"><ellipse cx="7" cy="7.5" rx="2.1" ry="2.7"/><ellipse cx="12" cy="5.6" rx="2.1" ry="2.8"/><ellipse cx="17" cy="7.5" rx="2.1" ry="2.7"/><ellipse cx="19.6" cy="12.4" rx="2" ry="2.4"/><path d="M12 11.4c2.4 0 4.6 1.7 5.5 3.9.9 2.2-.2 4.4-2.4 4.9-1 .2-2-.1-3.1-.1s-2.1.3-3.1.1c-2.2-.5-3.3-2.7-2.4-4.9.9-2.2 3.1-3.9 5.5-3.9z"/></svg>',
        treats:   '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.6 7.6l8.8 8.8" stroke="currentColor" stroke-width="4.6" stroke-linecap="round" fill="none"/><circle cx="8.9" cy="6.1" r="2.9"/><circle cx="6.1" cy="8.9" r="2.9"/><circle cx="17.9" cy="15.1" r="2.9"/><circle cx="15.1" cy="17.9" r="2.9"/></svg>'
    };

    // ── CSRF Token ──────────────────────────────────────────
    let csrfToken = null;

    function fetchCsrfToken() {
        return fetch(BASE_URL + "/api/csrf-token")
            .then(function (r) { return r.json(); })
            .then(function (data) {
                csrfToken = data.token;
                return data.token;
            })
            .catch(function () { /* token endpoint not available in embed mode */ });
    }

    fetchCsrfToken();

    // ── DOM refs ────────────────────────────────────────────
    const panel           = document.getElementById("chatPanel");
    const chatBox         = document.getElementById("chat-box");
    const input           = document.getElementById("message-input");
    const sendBtn         = document.getElementById("sendBtn");
    const settingsMenu    = document.getElementById("settingsMenu");
    const expandToggle    = document.getElementById("expandToggle");
    const themeToggle     = document.getElementById("themeToggle");
    const langSelect      = document.getElementById("langSelect");
    const badge           = document.getElementById("eniqBadge");
    const attachBtn       = document.getElementById("attachBtn");
    const emojiBtn        = document.getElementById("emojiBtn");
    const voiceBtn        = document.getElementById("voiceBtn");
    const fileInput       = document.getElementById("fileInput");
    const emojiPanel      = document.getElementById("emojiPanel");
    const attachPreview   = document.getElementById("attachPreview");
    const soundToggle     = document.getElementById("soundToggle");
    const animToggle      = document.getElementById("animToggle");
    const fontSelect      = document.getElementById("fontSelect");
    const consentBox      = document.getElementById("consentBox");
    const voiceView       = document.getElementById("voiceView");
    const modeChatBtn     = document.getElementById("modeChatBtn");
    const modeVoiceBtn    = document.getElementById("modeVoiceBtn");
    const invitePopup     = document.getElementById("invitePopup");

    // ── State ───────────────────────────────────────────────
    let selectedLang   = localStorage.getItem("eniq_lang") || "cs";
    let isDarkMode     = localStorage.getItem("eniq_theme") === "dark";
    let isExpanded     = localStorage.getItem("eniq_expanded") === "true";
    let sessionId      = sessionStorage.getItem("session_id") || null;
    let audioUnlocked  = false;
    let quickActionsShown = false;
    let searchingEl    = null;
    let soundEnabled   = localStorage.getItem("autoaws_sound") !== "off";
    let animEnabled    = localStorage.getItem("autoaws_anim") !== "off";
    let fontSize       = localStorage.getItem("autoaws_font") || "md";
    let attachedFiles  = [];
    let recognition    = null;
    let listening      = false;
    let inviteTimer    = null;
    let inviteAutoTimer = null;

    // ── Texts – Auto AWS ─────────────────────────────────
    const UI_TEXT = {
        cs: {
            welcome: "Dobrý den! Jsem asistent Auto AWS. Rád poradím s výběrem auta, financováním, dopravou, platbou, reklamací, GDPR nebo kontaktem.",
            welcomeHtml: "Dobrý den! Jsem asistent <strong>Auto AWS</strong>. Rád poradím s výběrem auta, financováním, dopravou, platbou, reklamací, GDPR nebo kontaktem. Zeptejte se, nebo zvolte rychlou akci níže.",
            placeholder: "Napište zprávu…",
            expandLabel: "Rozšířit chat",
            themeLabel: "Tmavý režim",
            error: "Omlouvám se, něco se pokazilo. Zkuste to prosím znovu, nebo napište na info@autoaws.cz.",
            showOnPage: "Chcete přejít na stránku Auto AWS?",
            btnYes: "Ano, přejít",
            redirecting: "Přesměrovávám…",
            terms: "Na webu autoaws.cz není samostatná stránka <strong>Obchodní podmínky</strong> — konkrétní smlouva se řeší při koupi. Obecné info: <strong>autoaws.cz/financovani</strong>, <strong>autoaws.cz/zaruka</strong>, <strong>autoaws.cz/kontakt</strong>. Dotazy: <strong>+420 777 834 466</strong>.",
            shipping: "Auto AWS je prodejce vozů — <strong>zásilková doprava se neuplatňuje</strong>. Vůz si převezmete v showroomu v Uherském Brodě (Cihlářská 422), ideálně po domluvě na <strong>+420 777 834 466</strong>. Financování na místě: <strong>autoaws.cz/financovani</strong>.",
            contact: "Zavolejte na <strong>+420 777 834 466</strong> nebo napište na <strong>info@autoaws.cz</strong>. Provozovna Po–Pá 9:00–17:00, So 9:00–11:00. Adresa: Cihlářská 422, Havřice, 688 01 Uherský Brod. Více: <strong>autoaws.cz/kontakt</strong>.",
            returns: "Reklamace se řeší podle zákona a kupní smlouvy. Kontaktujte prodejce na <strong>+420 777 834 466</strong> nebo <strong>info@autoaws.cz</strong>. Info o záruce: <strong>autoaws.cz/zaruka</strong>.",
            gdpr: "Zásady zpracování osobních údajů: <strong>autoaws.cz/zpracovani-osobnich-udaju</strong>. Správcem je provozovatel Auto AWS (Vít Hauerland), nikoli poskytovatel chatbota.",
            articles: "Na webu není blog ani sekce Návody. Užitečné informace: <strong>autoaws.cz/automobily</strong>, <strong>autoaws.cz/financovani</strong>, <strong>autoaws.cz/zaruka</strong>. K dotazu k vozu: <strong>+420 777 834 466</strong>.",
            about: "<strong>Auto AWS</strong> prodává a dováží koncernové automobily (Audi, VW, Škoda, Seat, Cupra) z Německa od roku 1998. Showroom v Uherském Brodě. Více: <strong>autoaws.cz/kontakt</strong>.",
            promo: "Veřejný seznam akcí na webu není. U některých vozů je <strong>záruka zdarma</strong> — autoaws.cz/zaruka. Individuální slevy ověřte na <strong>+420 777 834 466</strong>.",
            food: "V nabídce máme především značky <strong>Audi, Volkswagen, Škoda, Seat a Cupra</strong> — mladší vozy dovezené z Německa. Nabídka: <strong>autoaws.cz/automobily</strong>.",
            treats: "Nabízíme <strong>financování přes Moneta Auto</strong> — až 100 % ceny vozu, splácení až 84 měsíců. Více: <strong>autoaws.cz/financovani</strong>."
        },
        sk: {
            food: "Krmivá vedieme pre psov, mačky, hlodavce, vtáctvo aj akva-teru – granule, konzervy, kapsičky aj varené krmivo. Značky <strong>Magnum Dog Food</strong>, <strong>Alpha Spirit</strong>, <strong>Profine</strong>, <strong>Brit</strong>. Napíšte mi, pre aké zviera vyberáte.",
            treats: "Maškrty máme pre psov, mačky aj hlodavce – prírodné kosti, sušené tyčinky, salámy aj dentálne pochúťky. Silná je rada <strong>Magnum</strong> a <strong>Alpha Spirit</strong>. Pre psa, alebo pre mačku?",
            contact: "Zavolajte na <strong>+420 777 834 466</strong> alebo napíšte na <strong>info@autoaws.cz</strong>. Veľkoobchod Po–Pi 8:00–16:30, maloobchod Po–Pi 8:00–18:00.",
            shipping: "Rozvážame po celej ČR, alebo si tovar vyzdvihnete v sklade v Libiši (Po–Pi 8:00–16:30). Minimálna objednávka <strong>1 200 Kč s DPH</strong>, doprava <strong>zadarmo od 4 000 Kč s DPH</strong> (do 30 kg), inak 150 Kč s DPH.",
            returns: "Ak tovar dorazí poškodený a obal je celý, pripravte kvalitné fotky tovaru aj obalu – bez nich prepravca reklamáciu zamietne. Pošlite na info@autoaws.cz. Sme veľkoobchod pre podnikateľov.",
            terms: "Kompletné obchodné podmienky nájdete na autoaws.cz. Platia pre podnikateľov – právnické osoby a živnostníkov."
        },
        en: {
            food: "We stock food for dogs, cats, rodents, birds and aquatic pets – kibble, cans, pouches and cooked food. Brands include <strong>Magnum Dog Food</strong>, <strong>Alpha Spirit</strong>, <strong>Profine</strong> and <strong>Brit</strong>. Tell me which animal you're buying for.",
            treats: "We have treats for dogs, cats and rodents – natural bones, dried sticks, sausages, sandwiches and dental chews. The <strong>Magnum</strong> and <strong>Alpha Spirit</strong> lines are strong. Tips for a dog or a cat?",
            contact: "Call <strong>+420 777 834 466</strong> or email <strong>info@autoaws.cz</strong>. Wholesale Mon–Fri 8:00–16:30, retail Mon–Fri 8:00–18:00. Warehouse: Cihlářská 422, 688 01 Uherský Brod.",
            shipping: "We deliver across Czechia or you can collect at our Libiš warehouse (Mon–Fri 8:00–16:30). Minimum order <strong>CZK 1,200 incl. VAT</strong>, shipping <strong>free from CZK 4,000 incl. VAT</strong> (up to 30 kg), otherwise CZK 150 incl. VAT. Orders before 12:30 arrive the next business day.",
            returns: "If goods arrive damaged while the packaging is intact, take clear photos of the goods and the packaging – without them the carrier rejects the claim. Send them to info@autoaws.cz. We are a wholesaler for businesses.",
            terms: "Full terms are on autoaws.cz under Obchodní podmínky. They apply to businesses – companies and self-employed traders."
        },
        de: {
            food: "Wir führen Futter für Hunde, Katzen, Nager, Vögel und Aquaristik – Trockenfutter, Dosen, Frischebeutel. Marken: <strong>Magnum Dog Food</strong>, <strong>Alpha Spirit</strong>, <strong>Profine</strong>, <strong>Brit</strong>. Für welches Tier suchen Sie?",
            treats: "Snacks für Hunde, Katzen und Nager – Naturknochen, Trockensticks, Würstchen, Sandwiches, Dentalsnacks. Stark sind <strong>Magnum</strong> und <strong>Alpha Spirit</strong>. Hund oder Katze?",
            contact: "Rufen Sie <strong>+420 777 834 466</strong> an oder schreiben Sie an <strong>info@autoaws.cz</strong>. Großhandel Mo–Fr 8:00–16:30, Einzelhandel Mo–Fr 8:00–18:00.",
            shipping: "Wir liefern tschechienweit oder Sie holen im Lager Libiš ab (Mo–Fr 8:00–16:30). Mindestbestellwert <strong>1.200 CZK inkl. MwSt.</strong>, Versand <strong>ab 4.000 CZK inkl. MwSt. kostenlos</strong> (bis 30 kg), sonst 150 CZK.",
            returns: "Kommt die Ware beschädigt an und die Verpackung ist unversehrt, machen Sie gute Fotos von Ware und Verpackung – ohne diese lehnt der Frachtführer ab. Senden an info@autoaws.cz. Wir sind Großhandel für Unternehmen.",
            terms: "Die vollständigen AGB finden Sie auf autoaws.cz. Sie gelten für Unternehmen – juristische Personen und Gewerbetreibende."
        },
        fr: {
            food: "Nous proposons des aliments pour chiens, chats, rongeurs, oiseaux et aquariophilie – croquettes, boîtes, sachets. Marques : <strong>Magnum Dog Food</strong>, <strong>Alpha Spirit</strong>, <strong>Profine</strong>, <strong>Brit</strong>. Pour quel animal ?",
            treats: "Friandises pour chiens, chats et rongeurs – os naturels, bâtonnets séchés, saucisses, sandwichs, dentaires. Les gammes <strong>Magnum</strong> et <strong>Alpha Spirit</strong> sont fortes. Chien ou chat ?",
            contact: "Appelez le <strong>+420 777 834 466</strong> ou écrivez à <strong>info@autoaws.cz</strong>. Gros lun–ven 8h–16h30, détail lun–ven 8h–18h.",
            shipping: "Nous livrons dans toute la Tchéquie ou retrait à l'entrepôt de Libiš (lun–ven 8h–16h30). Commande minimale <strong>1 200 CZK TTC</strong>, livraison <strong>gratuite dès 4 000 CZK TTC</strong> (jusqu'à 30 kg), sinon 150 CZK.",
            returns: "Si la marchandise arrive endommagée avec un emballage intact, photographiez nettement la marchandise et l'emballage – sans cela le transporteur refuse. Envoyez à info@autoaws.cz. Nous sommes grossiste pour professionnels.",
            terms: "Les conditions générales sont sur autoaws.cz. Elles s'appliquent aux professionnels – sociétés et indépendants."
        },
        es: {
            food: "Tenemos alimentos para perros, gatos, roedores, aves y acuariofilia – pienso, latas y sobres. Marcas: <strong>Magnum Dog Food</strong>, <strong>Alpha Spirit</strong>, <strong>Profine</strong>, <strong>Brit</strong>. ¿Para qué animal busca?",
            treats: "Premios para perros, gatos y roedores – huesos naturales, barritas secas, salchichas, sándwiches y dentales. Destacan <strong>Magnum</strong> y <strong>Alpha Spirit</strong>. ¿Perro o gato?",
            contact: "Llame al <strong>+420 777 834 466</strong> o escriba a <strong>info@autoaws.cz</strong>. Mayorista lun–vie 8:00–16:30, minorista lun–vie 8:00–18:00.",
            shipping: "Entregamos en toda Chequia o recoge en el almacén de Libiš (lun–vie 8:00–16:30). Pedido mínimo <strong>1.200 CZK con IVA</strong>, envío <strong>gratis desde 4.000 CZK con IVA</strong> (hasta 30 kg), si no 150 CZK.",
            returns: "Si la mercancía llega dañada con el embalaje intacto, haga fotos nítidas del producto y del embalaje – sin ellas el transportista rechaza. Envíelas a info@autoaws.cz. Somos mayorista para empresas.",
            terms: "Las condiciones completas están en autoaws.cz. Se aplican a empresas – personas jurídicas y autónomos."
        },
        it: {
            food: "Abbiamo alimenti per cani, gatti, roditori, uccelli e acquari – crocchette, lattine e buste. Marchi: <strong>Magnum Dog Food</strong>, <strong>Alpha Spirit</strong>, <strong>Profine</strong>, <strong>Brit</strong>. Per quale animale?",
            treats: "Snack per cani, gatti e roditori – ossa naturali, bastoncini essiccati, salamini, sandwich e dentali. Forti le linee <strong>Magnum</strong> e <strong>Alpha Spirit</strong>. Cane o gatto?",
            contact: "Chiami il <strong>+420 777 834 466</strong> o scriva a <strong>info@autoaws.cz</strong>. Ingrosso lun–ven 8:00–16:30, dettaglio lun–ven 8:00–18:00.",
            shipping: "Consegniamo in tutta la Cechia o ritiro al magazzino di Libiš (lun–ven 8:00–16:30). Ordine minimo <strong>1.200 CZK IVA incl.</strong>, spedizione <strong>gratuita da 4.000 CZK IVA incl.</strong> (fino a 30 kg), altrimenti 150 CZK.",
            returns: "Se la merce arriva danneggiata con l'imballo integro, fotografi merce e imballo – senza foto il corriere respinge. Invii a info@autoaws.cz. Siamo grossisti per imprese.",
            terms: "Le condizioni complete sono su autoaws.cz. Si applicano alle imprese – persone giuridiche e lavoratori autonomi."
        },
        pl: {
            food: "Mamy karmy dla psów, kotów, gryzoni, ptaków i akwarystyki – suche, puszki, saszetki. Marki: <strong>Magnum Dog Food</strong>, <strong>Alpha Spirit</strong>, <strong>Profine</strong>, <strong>Brit</strong>. Dla jakiego zwierzaka szukasz?",
            treats: "Przysmaki dla psów, kotów i gryzoni – kości naturalne, suszone paluszki, salami, kanapki i dentystyczne. Mocne są <strong>Magnum</strong> i <strong>Alpha Spirit</strong>. Pies czy kot?",
            contact: "Zadzwoń pod <strong>+420 777 834 466</strong> lub napisz na <strong>info@autoaws.cz</strong>. Hurt pon–pt 8:00–16:30, detal pon–pt 8:00–18:00.",
            shipping: "Dostarczamy w całych Czechach lub odbiór w magazynie w Libiši (pon–pt 8:00–16:30). Minimalne zamówienie <strong>1 200 CZK z VAT</strong>, dostawa <strong>gratis od 4 000 CZK z VAT</strong> (do 30 kg), inaczej 150 CZK.",
            returns: "Jeśli towar dotrze uszkodzony, a opakowanie jest całe, zrób wyraźne zdjęcia towaru i opakowania – bez nich przewoźnik odrzuci. Wyślij na info@autoaws.cz. Jesteśmy hurtownią dla firm.",
            terms: "Pełny regulamin znajdziesz na autoaws.cz. Dotyczy przedsiębiorców – osób prawnych i samozatrudnionych."
        },
        uk: {
            food: "Маємо корми для собак, котів, гризунів, птахів і акваріумістики – сухі, консерви, паучі. Бренди: <strong>Magnum Dog Food</strong>, <strong>Alpha Spirit</strong>, <strong>Profine</strong>, <strong>Brit</strong>. Для якої тварини обираєте?",
            treats: "Ласощі для собак, котів і гризунів – натуральні кістки, сушені палички, ковбаски, сендвічі та дентальні. Сильні лінійки <strong>Magnum</strong> та <strong>Alpha Spirit</strong>. Собака чи кіт?",
            contact: "Телефонуйте <strong>+420 777 834 466</strong> або пишіть на <strong>info@autoaws.cz</strong>. Опт Пн–Пт 8:00–16:30, роздріб Пн–Пт 8:00–18:00.",
            shipping: "Доставляємо по всій Чехії або самовивіз зі складу в Лібіші (Пн–Пт 8:00–16:30). Мінімальне замовлення <strong>1 200 Kč з ПДВ</strong>, доставка <strong>безкоштовна від 4 000 Kč з ПДВ</strong> (до 30 кг), інакше 150 Kč.",
            returns: "Якщо товар пошкоджений, а упаковка ціла, зробіть якісні фото товару й упаковки – без них перевізник відхилить. Надішліть на info@autoaws.cz. Ми оптовик для підприємців.",
            terms: "Повні умови на autoaws.cz. Діють для підприємців – юридичних осіб і ФОП."
        }
    };

    // Doplnění chybějících polí u ostatních jazyků (fallback na češtinu)
    (function fillUiDefaults() {
        var keys = ["welcome", "welcomeHtml", "placeholder", "expandLabel", "themeLabel", "error", "showOnPage", "btnYes", "redirecting",
            "terms", "shipping", "contact", "returns", "gdpr", "articles", "about", "promo", "food", "treats"];
        ["sk", "en", "de", "fr", "es", "it", "pl", "uk"].forEach(function (lang) {
            if (!UI_TEXT[lang]) UI_TEXT[lang] = {};
            keys.forEach(function (k) {
                if (!UI_TEXT[lang][k] && UI_TEXT.cs[k]) UI_TEXT[lang][k] = UI_TEXT.cs[k];
            });
        });
    })();

    const INSTANT_ANSWERS = UI_TEXT;

    const QUICK_ACTIONS_TEXT = {
        cs: [
            { key: "terms",    label: "Obchodní podmínky" },
            { key: "shipping", label: "Doprava a platba" },
            { key: "contact",  label: "Kontakt" },
            { key: "returns",  label: "Reklamace" },
            { key: "gdpr",     label: "GDPR" },
            { key: "articles", label: "Návody / články" },
            { key: "about",    label: "O firmě" },
            { key: "promo",    label: "Akce / slevy" }
        ],
        sk: [
            { key: "food",     label: "Nabídka aut" },
            { key: "treats",   label: "Maškrty" },
            { key: "shipping", label: "Ověření vozů" },
            { key: "contact",  label: "Kontakt" }
        ],
        en: [
            { key: "food",     label: "Pet food" },
            { key: "treats",   label: "Treats" },
            { key: "shipping", label: "Shipping" },
            { key: "contact",  label: "Contact" }
        ],
        de: [
            { key: "food",     label: "Futter" },
            { key: "treats",   label: "Snacks" },
            { key: "shipping", label: "Versand" },
            { key: "contact",  label: "Kontakt" }
        ],
        fr: [
            { key: "food",     label: "Aliments" },
            { key: "treats",   label: "Friandises" },
            { key: "shipping", label: "Livraison" },
            { key: "contact",  label: "Contact" }
        ],
        es: [
            { key: "food",     label: "Alimentos" },
            { key: "treats",   label: "Premios" },
            { key: "shipping", label: "Envío" },
            { key: "contact",  label: "Contacto" }
        ],
        it: [
            { key: "food",     label: "Alimenti" },
            { key: "treats",   label: "Snack" },
            { key: "shipping", label: "Spedizione" },
            { key: "contact",  label: "Contatti" }
        ],
        pl: [
            { key: "food",     label: "Karma" },
            { key: "treats",   label: "Przysmaki" },
            { key: "shipping", label: "Dostawa" },
            { key: "contact",  label: "Kontakt" }
        ],
        uk: [
            { key: "food",     label: "Корм" },
            { key: "treats",   label: "Ласощі" },
            { key: "shipping", label: "Доставка" },
            { key: "contact",  label: "Контакти" }
        ]
    };

    // ── Extra UI texts (disclaimer, consent, settings, voice) ──
    const EXTRA_TEXT = {
        cs: {
            disclaimer: "Asistent může dělat chyby. Důležité informace si ověřte.",
            consentLink: "Zpracování osobních údajů",
            consentFull: "Vaše zprávy zpracovává provozovatel Auto AWS (Vít Hauerland) jako správce osobních údajů – nikoli poskytovatel chatbota. Údaje slouží výhradně k vyřízení vašeho dotazu a neukládají se déle, než je nutné. Více na autoaws.cz/zpracovani-osobnich-udaju.",
            consentBannerHtml: "Vaše zprávy zpracovává <strong>Auto AWS</strong> (správce údajů), ne poskytovatel chatbota. Používáním souhlasíte.",
            consentOk: "Rozumím",
            listening: "Poslouchám…",
            animLabel: "Animace a efekty",
            soundLabel: "Zvuk zpráv",
            fontLabel: "Velikost písma",
            langLabel2: "Jazyk",
            clearLabel: "Resetovat konverzaci"
        },
        sk: {
            disclaimer: "Asistent môže robiť chyby. Dôležité informácie si overte.",
            consentLink: "Spracovanie osobných údajov",
            consentFull: "Vaše správy spracúva prevádzkovateľ velkoobchodu TENESCO ako správca osobných údajov – nie poskytovateľ chatbota. Údaje slúžia výhradne na vybavenie vašej otázky a neukladajú sa dlhšie, než je nutné. Viac v Zásadách ochrany osobných údajov na webe TENESCO.",
            consentBannerHtml: "Vaše správy spracúva <strong>velkoobchod TENESCO</strong> (správca údajov), nie poskytovateľ chatbota. Používaním súhlasíte.",
            consentOk: "Rozumiem",
            listening: "Počúvam…",
            animLabel: "Animácie a efekty",
            soundLabel: "Zvuk správ",
            fontLabel: "Veľkosť písma",
            langLabel2: "Jazyk",
            clearLabel: "Resetovať konverzáciu"
        },
        en: {
            disclaimer: "The assistant can make mistakes. Please verify important info.",
            consentLink: "Personal data processing",
            consentFull: "Your messages are processed by the operator of the TENESCO e-shop as the data controller – not by the chatbot provider. The data is used solely to handle your query and is not kept longer than necessary. See the Privacy Policy on the TENESCO website.",
            consentBannerHtml: "Your messages are processed by the <strong>TENESCO e-shop</strong> (data controller), not the chatbot provider. By using it you agree.",
            consentOk: "Got it",
            listening: "Listening…",
            animLabel: "Animations & effects",
            soundLabel: "Message sound",
            fontLabel: "Font size",
            langLabel2: "Language",
            clearLabel: "Reset conversation"
        },
        de: {
            disclaimer: "Der Assistent kann Fehler machen. Bitte wichtige Infos prüfen.",
            consentLink: "Verarbeitung personenbezogener Daten",
            consentFull: "Ihre Nachrichten werden vom Betreiber des TENESCO-Shops als Verantwortlichem verarbeitet – nicht vom Anbieter des Chatbots. Die Daten dienen ausschließlich der Bearbeitung Ihrer Anfrage und werden nicht länger als nötig gespeichert. Mehr in der Datenschutzerklärung auf TENESCO.",
            consentBannerHtml: "Ihre Nachrichten verarbeitet der <strong>TENESCO-Shop</strong> (Verantwortlicher), nicht der Chatbot-Anbieter. Mit der Nutzung stimmen Sie zu.",
            consentOk: "Verstanden",
            listening: "Ich höre zu…",
            animLabel: "Animationen & Effekte",
            soundLabel: "Nachrichtenton",
            fontLabel: "Schriftgröße",
            langLabel2: "Sprache",
            clearLabel: "Konversation zurücksetzen"
        },
        fr: {
            disclaimer: "L'assistant peut faire des erreurs. Vérifiez les informations importantes.",
            consentLink: "Traitement des données personnelles",
            consentFull: "Vos messages sont traités par l'exploitant de la boutique TENESCO en tant que responsable du traitement – et non par le fournisseur du chatbot. Les données servent uniquement à traiter votre demande et ne sont pas conservées plus longtemps que nécessaire. Voir la politique de confidentialité sur TENESCO.",
            consentBannerHtml: "Vos messages sont traités par la <strong>boutique TENESCO</strong> (responsable du traitement), pas par le fournisseur du chatbot. En l'utilisant, vous acceptez.",
            consentOk: "Compris",
            listening: "J'écoute…",
            animLabel: "Animations et effets",
            soundLabel: "Son des messages",
            fontLabel: "Taille du texte",
            langLabel2: "Langue",
            clearLabel: "Réinitialiser la conversation"
        },
        es: {
            disclaimer: "El asistente puede cometer errores. Verifica la información importante.",
            consentLink: "Tratamiento de datos personales",
            consentFull: "Tus mensajes son tratados por el operador de la tienda TENESCO como responsable del tratamiento, no por el proveedor del chatbot. Los datos se usan solo para atender tu consulta y no se conservan más de lo necesario. Consulta la política de privacidad en TENESCO.",
            consentBannerHtml: "Tus mensajes los trata la <strong>tienda TENESCO</strong> (responsable de los datos), no el proveedor del chatbot. Al usarlo, aceptas.",
            consentOk: "Entendido",
            listening: "Escuchando…",
            animLabel: "Animaciones y efectos",
            soundLabel: "Sonido de mensajes",
            fontLabel: "Tamaño del texto",
            langLabel2: "Idioma",
            clearLabel: "Reiniciar conversación"
        },
        it: {
            disclaimer: "L'assistente può commettere errori. Verifica le informazioni importanti.",
            consentLink: "Trattamento dei dati personali",
            consentFull: "I tuoi messaggi sono trattati dal gestore del negozio TENESCO come titolare del trattamento, non dal fornitore del chatbot. I dati servono solo a gestire la tua richiesta e non vengono conservati più del necessario. Vedi l'informativa sulla privacy su TENESCO.",
            consentBannerHtml: "I tuoi messaggi sono trattati dal <strong>negozio TENESCO</strong> (titolare dei dati), non dal fornitore del chatbot. Usandolo, acconsenti.",
            consentOk: "Ho capito",
            listening: "In ascolto…",
            animLabel: "Animazioni ed effetti",
            soundLabel: "Suono dei messaggi",
            fontLabel: "Dimensione del testo",
            langLabel2: "Lingua",
            clearLabel: "Reimposta conversazione"
        },
        pl: {
            disclaimer: "Asystent może popełniać błędy. Sprawdź ważne informacje.",
            consentLink: "Przetwarzanie danych osobowych",
            consentFull: "Twoje wiadomości przetwarza operator sklepu TENESCO jako administrator danych – nie dostawca chatbota. Dane służą wyłącznie do obsługi zapytania i nie są przechowywane dłużej niż to konieczne. Więcej w polityce prywatności na TENESCO.",
            consentBannerHtml: "Twoje wiadomości przetwarza <strong>sklep TENESCO</strong> (administrator danych), nie dostawca chatbota. Korzystając, wyrażasz zgodę.",
            consentOk: "Rozumiem",
            listening: "Słucham…",
            animLabel: "Animacje i efekty",
            soundLabel: "Dźwięk wiadomości",
            fontLabel: "Rozmiar tekstu",
            langLabel2: "Język",
            clearLabel: "Zresetuj rozmowę"
        },
        uk: {
            disclaimer: "Асистент може помилятися. Перевіряйте важливу інформацію.",
            consentLink: "Обробка персональних даних",
            consentFull: "Ваші повідомлення обробляє оператор магазину TENESCO як розпорядник персональних даних, а не постачальник чат-бота. Дані використовуються лише для опрацювання вашого запиту й не зберігаються довше, ніж потрібно. Докладніше в політиці конфіденційності на TENESCO.",
            consentBannerHtml: "Ваші повідомлення обробляє <strong>магазин TENESCO</strong> (розпорядник даних), а не постачальник чат-бота. Користуючись, ви погоджуєтесь.",
            consentOk: "Зрозуміло",
            listening: "Слухаю…",
            animLabel: "Анімації та ефекти",
            soundLabel: "Звук повідомлень",
            fontLabel: "Розмір шрифту",
            langLabel2: "Мова",
            clearLabel: "Скинути розмову"
        }
    };

    const LANG_CODE = { cs: "cs-CZ", sk: "sk-SK", en: "en-US", de: "de-DE", fr: "fr-FR", es: "es-ES", it: "it-IT", pl: "pl-PL", uk: "uk-UA" };

    const EMOJIS = ["😀","😁","😄","😊","🙂","😉","😍","🥰","😘","😎","🤩","🤔","🙃","😅","😂","🤣","😇","😋","🤗","🫶","👍","👎","👏","🙏","💪","👌","✌️","🤝","❤️","🧡","💛","💚","💙","💜","🔥","✨","🎉","🎁","⭐","💯","✅","❓","❗","💬","📦","🚚","💳","🛒","🛏️","😴","💤","🧸","☕","👋"];

    const FILE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';

    // ── Voice-mode texts ─────────────────────────────────────
    const VOICE_TEXT = {
        cs: { modeChat: "Chat", modeVoice: "Hlas", tapToSpeak: "Klepněte na mikrofon a mluvte", listening: "Poslouchám… · klepnutím ukončíte", thinking: "Přemýšlím…", speaking: "Odpovídám…", noSpeech: "Nic jsem nezachytil — klepněte a zkuste to znovu.", hint: "Hlasová varianta asistenta — mluvte přirozeně, odpovím vám i hlasem.", unsupported: "Hlasový režim vyžaduje moderní prohlížeč s mikrofonem.", fallback: "Rád pomůžu — zeptejte se mě třeba na dopravu, kontakt, reklamaci nebo obchodní podmínky.", you: "Vy" },
        sk: { modeChat: "Chat", modeVoice: "Hlas", tapToSpeak: "Klepnite na mikrofón a hovorte", listening: "Počúvam… · klepnutím ukončíte", thinking: "Premýšľam…", speaking: "Odpovedám…", noSpeech: "Nič som nezachytil — klepnite a skúste znova.", hint: "Hlasová varianta asistenta — hovorte prirodzene, odpoviem vám aj hlasom.", unsupported: "Hlasový režim vyžaduje moderný prehliadač s mikrofónom.", fallback: "Rád pomôžem — opýtajte sa ma na dopravu, kontakt, reklamáciu alebo obchodné podmienky.", you: "Vy" },
        en: { modeChat: "Chat", modeVoice: "Voice", tapToSpeak: "Tap the mic and speak", listening: "Listening… · tap to stop", thinking: "Thinking…", speaking: "Speaking…", noSpeech: "Didn't catch that — tap and try again.", hint: "Voice variant of the assistant — speak naturally, I'll reply by voice too.", unsupported: "Voice mode needs a modern browser with a microphone.", fallback: "Happy to help — ask me about shipping, contact, returns or terms.", you: "You" },
        de: { modeChat: "Chat", modeVoice: "Sprache", tapToSpeak: "Tippen Sie auf das Mikrofon und sprechen Sie", listening: "Ich höre zu… · zum Beenden tippen", thinking: "Ich denke nach…", speaking: "Ich antworte…", noSpeech: "Nichts gehört — tippen und erneut versuchen.", hint: "Sprachvariante des Assistenten — sprechen Sie natürlich, ich antworte auch per Sprache.", unsupported: "Der Sprachmodus benötigt einen modernen Browser mit Mikrofon.", fallback: "Gerne — fragen Sie mich zu Versand, Kontakt, Rückgabe oder Bedingungen.", you: "Sie" },
        fr: { modeChat: "Chat", modeVoice: "Voix", tapToSpeak: "Touchez le micro et parlez", listening: "J'écoute… · touchez pour arrêter", thinking: "Je réfléchis…", speaking: "Je réponds…", noSpeech: "Je n'ai rien entendu — touchez et réessayez.", hint: "Variante vocale de l'assistant — parlez naturellement, je réponds aussi à la voix.", unsupported: "Le mode vocal nécessite un navigateur moderne avec micro.", fallback: "Avec plaisir — demandez-moi la livraison, le contact, les retours ou les conditions.", you: "Vous" },
        es: { modeChat: "Chat", modeVoice: "Voz", tapToSpeak: "Toca el micrófono y habla", listening: "Escuchando… · toca para detener", thinking: "Pensando…", speaking: "Respondiendo…", noSpeech: "No te he oído — toca e inténtalo de nuevo.", hint: "Variante de voz del asistente — habla con naturalidad, también respondo por voz.", unsupported: "El modo de voz requiere un navegador moderno con micrófono.", fallback: "Con gusto — pregúntame por envío, contacto, devoluciones o condiciones.", you: "Tú" },
        it: { modeChat: "Chat", modeVoice: "Voce", tapToSpeak: "Tocca il microfono e parla", listening: "In ascolto… · tocca per terminare", thinking: "Sto pensando…", speaking: "Sto rispondendo…", noSpeech: "Non ho sentito — tocca e riprova.", hint: "Variante vocale dell'assistente — parla con naturalezza, rispondo anche a voce.", unsupported: "La modalità vocale richiede un browser moderno con microfono.", fallback: "Volentieri — chiedimi di spedizione, contatti, resi o condizioni.", you: "Tu" },
        pl: { modeChat: "Czat", modeVoice: "Głos", tapToSpeak: "Dotknij mikrofonu i mów", listening: "Słucham… · dotknij, aby zakończyć", thinking: "Myślę…", speaking: "Odpowiadam…", noSpeech: "Nic nie usłyszałem — dotknij i spróbuj ponownie.", hint: "Głosowy wariant asystenta — mów naturalnie, odpowiem też głosem.", unsupported: "Tryb głosowy wymaga nowoczesnej przeglądarki z mikrofonem.", fallback: "Chętnie pomogę — zapytaj o dostawę, kontakt, zwroty lub regulamin.", you: "Ty" },
        uk: { modeChat: "Чат", modeVoice: "Голос", tapToSpeak: "Торкніться мікрофона й говоріть", listening: "Слухаю… · торкніться, щоб зупинити", thinking: "Думаю…", speaking: "Відповідаю…", noSpeech: "Нічого не почув — торкніться й спробуйте ще раз.", hint: "Голосовий варіант асистента — говоріть природно, відповім і голосом.", unsupported: "Голосовий режим потребує сучасного браузера з мікрофоном.", fallback: "Залюбки допоможу — запитайте про доставку, контакти, повернення чи умови.", you: "Ви" }
    };

    const VOICE_KEYWORDS = {
        shipping: ["doprav","doruč","doruc","zásil","zasil","pošt","post","versand","ship","deliver","balík","balik","packet","livr","relais","env","entrega","reparto","spediz","conseg","dostaw","wysył","przesył","достав","відправ"],
        contact:  ["kontakt","telefon","email","e-mail","spoji","volat","mail","phone","contact","erreich","télépho","courriel","contacto","teléfono","correo","contatt","telefono","контакт","телефон","пошт","звʼяз","зв'яз","звяз"],
        returns:  ["reklamac","reklam","vrác","vrat","vrát","return","claim","rückgab","ruckgab","refund","retour","réclam","rembours","devoluc","reso","zwrot","gwaranc","záruk","zaruk","garan","поверн","рекламац","гаранті"],
        terms:    ["podmín","podmie","gdpr","údaj","udaj","ochran","terms","condition","privacy","beding","daten","obchodní","obchodne","confidential","données","condicion","privacid","datos","condizion","dati","regulamin","prywatn","dane","умов","конфіденц","дані"],
        about:    ["kdo jste","o firm","auto aws","provozovatel"],
        articles: ["návod","navod","článek","clanek","blog","tipy"],
        promo:    ["akce","sleva","slevy","výprodej","vyprodej","promo","kupon"]
    };

    const MIC_TEXT = {
        cs: { denied: "Mikrofon je zablokovaný. Povolte přístup k mikrofonu (ikona vlevo v adresním řádku) a zkuste to znovu.", error: "Mikrofon se teď nepodařilo spustit. Zkuste to prosím znovu, nebo napište zprávu v režimu Chat.", starting: "Povolte prosím přístup k mikrofonu…" },
        sk: { denied: "Mikrofón je zablokovaný. Povoľte prístup k mikrofónu (ikona v adresnom riadku) a skúste to znova.", error: "Mikrofón sa teraz nepodarilo spustiť. Skúste to znova, alebo napíšte v režime Chat.", starting: "Povoľte prosím prístup k mikrofónu…" },
        en: { denied: "The microphone is blocked. Please allow microphone access (lock icon in the address bar) and try again.", error: "Couldn't start the microphone. Please try again, or type in Chat mode.", starting: "Please allow microphone access…" },
        de: { denied: "Das Mikrofon ist blockiert. Bitte erlauben Sie den Mikrofonzugriff (Schloss-Symbol in der Adressleiste) und versuchen Sie es erneut.", error: "Das Mikrofon konnte nicht gestartet werden. Bitte erneut versuchen oder im Chat schreiben.", starting: "Bitte Mikrofonzugriff erlauben…" },
        fr: { denied: "Le micro est bloqué. Autorisez l'accès au microphone (icône dans la barre d'adresse) et réessayez.", error: "Impossible de démarrer le micro. Réessayez ou écrivez en mode Chat.", starting: "Veuillez autoriser l'accès au micro…" },
        es: { denied: "El micrófono está bloqueado. Permite el acceso al micrófono (icono en la barra de direcciones) e inténtalo de nuevo.", error: "No se pudo iniciar el micrófono. Inténtalo de nuevo o escribe en modo Chat.", starting: "Permite el acceso al micrófono…" },
        it: { denied: "Il microfono è bloccato. Consenti l'accesso al microfono (icona nella barra degli indirizzi) e riprova.", error: "Impossibile avviare il microfono. Riprova o scrivi in modalità Chat.", starting: "Consenti l'accesso al microfono…" },
        pl: { denied: "Mikrofon jest zablokowany. Zezwól na dostęp do mikrofonu (ikona w pasku adresu) i spróbuj ponownie.", error: "Nie udało się uruchomić mikrofonu. Spróbuj ponownie lub napisz w trybie Czat.", starting: "Zezwól na dostęp do mikrofonu…" },
        uk: { denied: "Мікрофон заблоковано. Дозвольте доступ до мікрофона (значок в адресному рядку) і спробуйте ще раз.", error: "Не вдалося запустити мікрофон. Спробуйте ще раз або напишіть у режимі Чат.", starting: "Дозвольте доступ до мікрофона…" }
    };

    // ── Invite popup texts ───────────────────────────────────
    const INVITE_TEXT = {
        cs: { greeting: "Dobrý den! 👋 Potřebujete poradit s výběrem auta, financováním, dopravou, reklamací nebo kontaktem? Rád pomůžu.", cta: "Začít konverzaci", online: "Online" },
        sk: { greeting: "Dobrý deň! 👋 Potrebujete poradiť s objednávkou, dopravou, reklamáciou alebo výberom produktu? Rád pomôžem.", cta: "Začať konverzáciu", online: "Online" },
        en: { greeting: "Hello! 👋 Need help with an order, shipping, a return or choosing a product? I'm happy to help.", cta: "Start a conversation", online: "Online" },
        de: { greeting: "Guten Tag! 👋 Brauchen Sie Hilfe bei Bestellung, Versand, Rückgabe oder Produktauswahl? Ich helfe gerne.", cta: "Konversation starten", online: "Online" },
        fr: { greeting: "Bonjour ! 👋 Besoin d'aide pour une commande, la livraison, un retour ou le choix d'un produit ? Je suis là.", cta: "Démarrer la conversation", online: "En ligne" },
        es: { greeting: "¡Hola! 👋 ¿Necesitas ayuda con un pedido, envío, devolución o elección de producto? Estoy aquí.", cta: "Iniciar conversación", online: "En línea" },
        it: { greeting: "Buongiorno! 👋 Hai bisogno di aiuto con un ordine, spedizione, reso o scelta del prodotto? Sono qui.", cta: "Avvia la conversazione", online: "Online" },
        pl: { greeting: "Dzień dobry! 👋 Potrzebujesz pomocy z zamówieniem, dostawą, zwrotem lub wyborem produktu? Chętnie pomogę.", cta: "Rozpocznij rozmowę", online: "Online" },
        uk: { greeting: "Доброго дня! 👋 Потрібна допомога із замовленням, доставкою, поверненням чи вибором товару? Залюбки допоможу.", cta: "Почати розмову", online: "Онлайн" }
    };

    // ── Close-confirm texts (voice running) ──────────────────
    const CONFIRM_TEXT = {
        cs: { msg: "Hlasový asistent právě běží. Chcete pokračovat v hovoru, nebo ho ukončit?", keep: "Pokračovat v hovoru", end: "Ukončit a zavřít" },
        sk: { msg: "Hlasový asistent práve beží. Chcete pokračovať v hovore, alebo ho ukončiť?", keep: "Pokračovať v hovore", end: "Ukončiť a zavrieť" },
        en: { msg: "The voice assistant is running. Do you want to keep talking, or end it?", keep: "Keep talking", end: "End & close" },
        de: { msg: "Der Sprachassistent läuft gerade. Möchten Sie weitersprechen oder beenden?", keep: "Weitersprechen", end: "Beenden & schließen" },
        fr: { msg: "L'assistant vocal est actif. Voulez-vous continuer à parler ou terminer ?", keep: "Continuer", end: "Terminer et fermer" },
        es: { msg: "El asistente de voz está activo. ¿Quieres seguir hablando o finalizar?", keep: "Seguir hablando", end: "Finalizar y cerrar" },
        it: { msg: "L'assistente vocale è attivo. Vuoi continuare a parlare o terminare?", keep: "Continua", end: "Termina e chiudi" },
        pl: { msg: "Asystent głosowy jest aktywny. Chcesz kontynuować rozmowę, czy zakończyć?", keep: "Kontynuuj rozmowę", end: "Zakończ i zamknij" },
        uk: { msg: "Голосовий асистент активний. Бажаєте продовжити розмову, чи завершити?", keep: "Продовжити розмову", end: "Завершити й закрити" }
    };

    // ── Session management ──────────────────────────────────
    const isReload = performance.getEntriesByType("navigation").some(function (nav) { return nav.type === "reload"; });
    if (isReload) {
        sessionStorage.removeItem("eniq_chat_history");
        sessionStorage.removeItem("session_id");
        sessionStorage.setItem("eniq_chat_open", "false");
    }

    // ── Helpers ─────────────────────────────────────────────
    function scrollToBottom() {
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // Soft notification beep (WebAudio – no external file)
    var audioCtx = null;
    function playBeep() {
        try {
            var AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            if (!audioCtx) audioCtx = new AC();
            if (audioCtx.state === "suspended") audioCtx.resume();
            var now = audioCtx.currentTime;
            var o = audioCtx.createOscillator();
            var g = audioCtx.createGain();
            o.type = "sine";
            o.frequency.setValueAtTime(680, now);
            o.frequency.exponentialRampToValueAtTime(880, now + 0.08);
            g.gain.setValueAtTime(0.0001, now);
            g.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
            o.connect(g); g.connect(audioCtx.destination);
            o.start(now);
            o.stop(now + 0.24);
        } catch (e) {}
    }

    // Pleasant two-note chime for the invite popup
    function playNotify() {
        if (!soundEnabled) return;
        try {
            var AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            if (!audioCtx) audioCtx = new AC();
            if (audioCtx.state === "suspended") audioCtx.resume();
            if (audioCtx.state !== "running") return;   // blocked until a user gesture
            var t = audioCtx.currentTime;
            [[880, 0], [1174.66, 0.14]].forEach(function (n) {
                var o = audioCtx.createOscillator();
                var g = audioCtx.createGain();
                o.type = "sine";
                o.frequency.value = n[0];
                var s = t + n[1];
                g.gain.setValueAtTime(0.0001, s);
                g.gain.exponentialRampToValueAtTime(0.09, s + 0.02);
                g.gain.exponentialRampToValueAtTime(0.0001, s + 0.26);
                o.connect(g); g.connect(audioCtx.destination);
                o.start(s);
                o.stop(s + 0.3);
            });
        } catch (e) {}
    }

    // Unlock audio on the first user gesture (browser autoplay policy)
    function unlockAudio() {
        audioUnlocked = true;
        try {
            var AC = window.AudioContext || window.webkitAudioContext;
            if (AC && !audioCtx) audioCtx = new AC();
            if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
        } catch (e) {}
    }

    // Auto-grow textarea + send-button dim state
    function autoGrowInput() {
        if (!input) return;
        input.style.height = "auto";
        input.style.height = Math.min(input.scrollHeight, 120) + "px";
    }
    function updateSendState() {
        if (sendBtn) sendBtn.classList.toggle("is-empty", !input.value.trim());
    }
    function resetComposerSize() {
        if (input) input.style.height = "auto";
        updateSendState();
    }

    function formatTime(when) {
        var d = when ? new Date(when) : new Date();
        var h = d.getHours();
        var m = d.getMinutes();
        return (h < 10 ? "0" + h : h) + ":" + (m < 10 ? "0" + m : m);
    }

    function saveMessageToHistory(text, sender, time, noTime) {
        var history = JSON.parse(sessionStorage.getItem("eniq_chat_history") || "[]");
        history.push({ text: text, sender: sender, time: time || Date.now(), noTime: !!noTime });
        sessionStorage.setItem("eniq_chat_history", JSON.stringify(history));
    }

    // Posledních pár tahů pro server – záloha kontextu po cold startu (serverless).
    // Text bereme z uložené historie a ořízneme, ať request nebobtná.
    function getRecentHistoryForServer() {
        try {
            var h = JSON.parse(sessionStorage.getItem("eniq_chat_history") || "[]");
            return h.slice(-10).map(function (m) {
                var t = String(m.text || "").replace(/<[^>]+>/g, "").slice(0, 1000);
                return { role: m.sender === "user" ? "user" : "assistant", content: t };
            }).filter(function (m) { return m.content.length > 0; });
        } catch (e) { return []; }
    }

    // ── Core: add message ───────────────────────────────────
    function addMessage(text, sender, playSound, save, typeEffect, onCompleteCallback, asHtml, time, noTime) {
        save = save !== undefined ? save : true;
        typeEffect = typeEffect !== undefined ? typeEffect : false;
        asHtml = asHtml !== undefined ? asHtml : false;
        noTime = noTime !== undefined ? noTime : false;
        var stamp = time || Date.now();

        var msgDiv = document.createElement("div");
        msgDiv.className = "message " + sender;

        if (sender === "bot") {
            var avatar = document.createElement("div");
            avatar.className = "message-avatar";
            var img = document.createElement("img");
            img.src = BOT_IMG;
            img.className = "bot-img";
            avatar.appendChild(img);
            msgDiv.appendChild(avatar);
        }

        var col = document.createElement("div");
        col.className = "bubble-col";
        var content = document.createElement("div");
        content.className = "message-content";
        col.appendChild(content);
        if (!noTime) {
            var timeEl = document.createElement("div");
            timeEl.className = "message-time";
            timeEl.textContent = formatTime(stamp);
            col.appendChild(timeEl);
        }
        msgDiv.appendChild(col);
        chatBox.appendChild(msgDiv);

        if (typeEffect && sender === "bot" && text) {
            content.textContent = "";
            var i = 0;
            var typingInterval = setInterval(function () {
                content.textContent += text.charAt(i);
                i++;
                scrollToBottom();
                if (i >= text.length) {
                    clearInterval(typingInterval);
                    if (save) saveMessageToHistory(text, sender, stamp, noTime);
                    if (onCompleteCallback) onCompleteCallback();
                }
            }, 15);
        } else {
            if (asHtml) content.innerHTML = text || "";
            else content.textContent = text || "";
            if (save) saveMessageToHistory(text, sender, stamp);
            if (onCompleteCallback) onCompleteCallback();
        }

        scrollToBottom();
        if (playSound && sender === "bot" && audioUnlocked && soundEnabled) {
            playBeep();
        }
    }

    // ── Quick actions ───────────────────────────────────────
    function showQuickActionsInChat() {
        if (quickActionsShown) return;
        quickActionsShown = true;

        var container = document.createElement("div");
        container.className = "quick-actions-inline";

        var actions = QUICK_ACTIONS_TEXT[selectedLang] || QUICK_ACTIONS_TEXT.cs;
        actions.forEach(function (action) {
            var btn = document.createElement("button");
            btn.className = "quick-action-btn";
            btn.dataset.action = action.key;
            var icon = QA_ICONS[action.key] || "";
            btn.innerHTML = '<span class="qa-icon">' + icon + '</span>' +
                            '<span class="qa-label">' + action.label + '</span>';
            container.appendChild(btn);
        });

        chatBox.appendChild(container);
        scrollToBottom();
    }

    // ── Searching indicator ─────────────────────────────────
    function showSearching() {
        var row = document.createElement("div");
        row.className = "message bot searching-row";
        row.innerHTML =
            '<div class="message-avatar"><img src="' + BOT_IMG + '" class="bot-img"></div>' +
            '<div class="message-content typing-indicator"><span></span><span></span><span></span></div>';
        chatBox.appendChild(row);
        searchingEl = row;
        scrollToBottom();
    }

    function removeSearching() {
        if (searchingEl) {
            searchingEl.remove();
            searchingEl = null;
        }
    }

    // ── Recommended links ───────────────────────────────────
    function showPageLinkPrompt(url, title, imageUrl) {
        var promptDiv = document.createElement("div");
        promptDiv.className = "page-link-prompt";

        var headerWrapper = document.createElement("div");
        headerWrapper.className = "page-link-header-wrapper";

        if (imageUrl) {
            var imgEl = document.createElement("img");
            imgEl.src = imageUrl;
            imgEl.className = "page-link-product-img";
            headerWrapper.appendChild(imgEl);
        }

        if (title) {
            var titleDiv = document.createElement("div");
            titleDiv.className = "page-link-product-title";
            titleDiv.textContent = title;
            headerWrapper.appendChild(titleDiv);
        }

        if (title || imageUrl) {
            promptDiv.appendChild(headerWrapper);
        }

        var textDiv = document.createElement("div");
        textDiv.className = "page-link-text";
        textDiv.textContent = UI_TEXT[selectedLang].showOnPage;

        var buttonsDiv = document.createElement("div");
        buttonsDiv.className = "page-link-buttons";

        var btnYes = document.createElement("button");
        btnYes.className = "page-link-btn page-link-btn-yes";
        btnYes.textContent = UI_TEXT[selectedLang].btnYes;

        btnYes.onclick = function () {
            btnYes.innerHTML = '<span class="spinner"></span> ' + UI_TEXT[selectedLang].redirecting;
            btnYes.disabled = true;
            sessionStorage.setItem("eniq_chat_open", "true");

            var overlay = document.createElement("div");
            overlay.className = "page-transition-overlay";
            overlay.innerHTML = '<div class="transition-spinner"></div>';
            document.body.appendChild(overlay);

            setTimeout(function () { overlay.classList.add("active"); }, 10);
            setTimeout(function () { gotoProduct(url); }, 450);
        };

        var btnNo = document.createElement("button");
        btnNo.className = "page-link-btn page-link-btn-no";
        btnNo.textContent = "✖ Skrýt";
        btnNo.onclick = function () {
            promptDiv.classList.add("fade-out");
            setTimeout(function () { promptDiv.remove(); }, 300);
        };

        buttonsDiv.appendChild(btnYes);
        buttonsDiv.appendChild(btnNo);
        promptDiv.appendChild(textDiv);
        promptDiv.appendChild(buttonsDiv);

        chatBox.appendChild(promptDiv);
        scrollToBottom();
    }

    // ── Send message ────────────────────────────────────────
    function sendMessage(text) {
        if (!text || !text.trim()) return;
        text = text.trim();
        input.value = "";

        addMessage(text, "user", false, true);
        showSearching();

        var currentUrl = window.location.href;

        fetch(BASE_URL + "/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken || ""
            },
            body: JSON.stringify({
                message: text,
                session_id: sessionId,
                language: selectedLang,
                current_page: currentUrl,
                mode: "chat",
                // záloha kontextu pro případ, že server běží serverless a ztratil session
                history: getRecentHistoryForServer()
            })
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            removeSearching();
            sessionId = data.session_id;
            sessionStorage.setItem("session_id", sessionId);

            addMessage(data.response, "bot", true, true, true, function () {
                if (data.recommended_links && data.recommended_links.length > 0) {
                    data.recommended_links.forEach(function (link) {
                        showPageLinkPrompt(link.url, link.title || null, link.image || null);
                    });
                }
            });
        })
        .catch(function () {
            removeSearching();
            addMessage(UI_TEXT[selectedLang].error, "bot", false, true, true);
        });
    }

    // ── File size helper ────────────────────────────────────
    function formatSize(bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    }

    // ── Emoji picker ─────────────────────────────────────────
    function buildEmojiPanel() {
        if (!emojiPanel) return;
        emojiPanel.innerHTML = "";
        EMOJIS.forEach(function (em) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "emoji-item";
            b.dataset.emoji = em;
            b.textContent = em;
            emojiPanel.appendChild(b);
        });
    }
    function toggleEmojiPanel() {
        if (emojiPanel) emojiPanel.classList.toggle("open");
    }
    function insertEmoji(em) {
        if (!em) return;
        var start = input.selectionStart != null ? input.selectionStart : input.value.length;
        var end = input.selectionEnd != null ? input.selectionEnd : input.value.length;
        input.value = input.value.slice(0, start) + em + input.value.slice(end);
        var pos = start + em.length;
        input.focus();
        try { input.setSelectionRange(pos, pos); } catch (e) {}
        autoGrowInput();
        updateSendState();
    }

    // ── Attachments ──────────────────────────────────────────
    function handleFiles(list) {
        Array.prototype.slice.call(list).forEach(function (f) {
            if (attachedFiles.length >= 5) return;          // max 5 files
            if (f.size > 10 * 1024 * 1024) return;          // max 10 MB
            attachedFiles.push(f);
        });
        renderAttachPreview();
    }
    function renderAttachPreview() {
        if (!attachPreview) return;
        attachPreview.innerHTML = "";
        if (!attachedFiles.length) { attachPreview.classList.remove("has-files"); return; }
        attachPreview.classList.add("has-files");
        attachedFiles.forEach(function (file, idx) {
            var chip = document.createElement("div");
            chip.className = "attach-chip";
            chip.innerHTML =
                '<span class="file-ic">' + FILE_ICON + '</span>' +
                '<span class="file-meta"><span class="file-name"></span><span class="file-size"></span></span>' +
                '<button type="button" class="attach-remove" data-index="' + idx + '" aria-label="Odebrat">×</button>';
            chip.querySelector(".file-name").textContent = file.name;
            chip.querySelector(".file-size").textContent = formatSize(file.size);
            attachPreview.appendChild(chip);
        });
    }
    function removeAttachment(idx) {
        if (idx >= 0 && idx < attachedFiles.length) {
            attachedFiles.splice(idx, 1);
            renderAttachPreview();
        }
    }
    function clearAttachments() {
        attachedFiles = [];
        renderAttachPreview();
    }
    function addFileCard(file) {
        var msgDiv = document.createElement("div");
        msgDiv.className = "message user";
        var col = document.createElement("div");
        col.className = "bubble-col";
        var content = document.createElement("div");
        content.className = "message-content file-card";
        content.innerHTML =
            '<span class="file-ic">' + FILE_ICON + '</span>' +
            '<span class="file-meta"><span class="file-name"></span><span class="file-size"></span></span>';
        content.querySelector(".file-name").textContent = file.name;
        content.querySelector(".file-size").textContent = formatSize(file.size);
        col.appendChild(content);
        var timeEl = document.createElement("div");
        timeEl.className = "message-time";
        timeEl.textContent = formatTime();
        col.appendChild(timeEl);
        msgDiv.appendChild(col);
        chatBox.appendChild(msgDiv);
        scrollToBottom();
    }

    // ── Voice input (Web Speech API) ─────────────────────────
    function setupVoice() {
        var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { if (voiceBtn) voiceBtn.style.display = "none"; return; }
        recognition = new SR();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = LANG_CODE[selectedLang] || "cs-CZ";
        recognition.onresult = function (e) {
            var t = "";
            for (var i = 0; i < e.results.length; i++) { t += e.results[i][0].transcript; }
            input.value = t;
            autoGrowInput();
            updateSendState();
        };
        recognition.onend = stopVoiceUI;
        recognition.onerror = function (e) {
            stopVoiceUI();
            var err = e && e.error;
            if (err === "not-allowed" || err === "service-not-allowed") {
                addMessage((MIC_TEXT[selectedLang] || MIC_TEXT.cs).denied, "bot", false, false);
            }
        };
    }
    function stopVoiceUI() {
        listening = false;
        if (voiceBtn) voiceBtn.classList.remove("recording");
        input.placeholder = UI_TEXT[selectedLang].placeholder;
    }

    // Ask for mic permission up-front so the prompt is clear (and errors surface)
    var micGranted = false;
    function ensureMic() {
        if (micGranted) return Promise.resolve(true);
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.resolve(true);
        return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
            micGranted = true;
            stream.getTracks().forEach(function (t) { t.stop(); });
            return true;
        }).catch(function () { return false; });
    }

    function toggleVoice() {
        if (!recognition) return;
        if (listening) { try { recognition.stop(); } catch (e) {} return; }
        ensureMic().then(function (ok) {
            if (!ok) { addMessage((MIC_TEXT[selectedLang] || MIC_TEXT.cs).denied, "bot", false, false); return; }
            try {
                recognition.lang = LANG_CODE[selectedLang] || "cs-CZ";
                recognition.start();
                listening = true;
                if (voiceBtn) voiceBtn.classList.add("recording");
                input.placeholder = EXTRA_TEXT[selectedLang].listening;
            } catch (e) {}
        });
    }

    // ── Composer submit (text + attachments) ─────────────────
    function submitComposer() {
        var text = input.value.trim();
        if (attachedFiles.length) {
            attachedFiles.forEach(function (f) { addFileCard(f); });
            clearAttachments();
        }
        if (text) { sendMessage(text); }
        if (emojiPanel) emojiPanel.classList.remove("open");
        resetComposerSize();
    }

    // ── Settings: sound / animations / font / clear ──────────
    function setSound(on) {
        soundEnabled = on;
        localStorage.setItem("autoaws_sound", on ? "on" : "off");
        if (soundToggle) soundToggle.classList.toggle("active", on);
    }
    function setAnim(on) {
        animEnabled = on;
        localStorage.setItem("autoaws_anim", on ? "on" : "off");
        if (panel) panel.classList.toggle("no-anim", !on);
        if (animToggle) animToggle.classList.toggle("active", on);
    }
    function setFont(size) {
        fontSize = size;
        localStorage.setItem("autoaws_font", size);
        if (panel) {
            panel.classList.remove("fs-sm", "fs-md", "fs-lg");
            panel.classList.add("fs-" + size);
        }
        if (fontSelect) fontSelect.value = size;
    }
    // Local-only reset of the visible conversation (like F5 for this visitor).
    // Nothing is deleted from any database — only the customer's on-screen history.
    function clearConversation() {
        chatBox.innerHTML = "";
        sessionStorage.removeItem("eniq_chat_history");
        sessionStorage.removeItem("session_id");
        sessionId = null;
        quickActionsShown = false;
        clearAttachments();
        if (input) input.value = "";
        resetComposerSize();
        if (typeof clearVoiceConv === "function") clearVoiceConv();   // also reset the voice transcript
        voiceSessionId = null;                                        // and the voice backend context
        if (emojiPanel) emojiPanel.classList.remove("open");
        addMessage(UI_TEXT[selectedLang].welcomeHtml, "bot", false, false, false, null, true, null, true);
        saveMessageToHistory(UI_TEXT[selectedLang].welcome, "bot", Date.now(), true);
        showQuickActionsInChat();
        if (settingsMenu) settingsMenu.classList.remove("active");
    }

    // ── Consent / disclaimer ─────────────────────────────────
    function fillConsentTexts() {
        var ex = EXTRA_TEXT[selectedLang] || EXTRA_TEXT.cs;
        var d = document.getElementById("disclaimerText");
        if (d) d.textContent = ex.disclaimer;
        var l = document.getElementById("consentLink");
        if (l) l.textContent = ex.consentLink;
        if (consentBox) consentBox.textContent = ex.consentFull;
    }
    function showConsentBannerIfNeeded() {
        if (localStorage.getItem("tenesco_consent") === "1") return;
        var ex = EXTRA_TEXT[selectedLang] || EXTRA_TEXT.cs;
        var ban = document.createElement("div");
        ban.className = "consent-banner";
        ban.id = "consentBanner";
        ban.innerHTML =
            '<div class="consent-row">' +
                '<span class="consent-msg">' + ex.consentBannerHtml + '</span>' +
                '<button type="button" class="consent-ok" id="consentOk">' + ex.consentOk + '</button>' +
            '</div>';
        chatBox.appendChild(ban);
    }
    function dismissConsent() {
        localStorage.setItem("tenesco_consent", "1");
        var b = document.getElementById("consentBanner");
        if (b) { b.classList.add("fade-out"); setTimeout(function () { b.remove(); }, 300); }
    }

    // ── Voice mode (second variant) — continuous conversation ─
    // v2: records audio (MediaRecorder) + transcribes on the server (works on Chrome, Safari, iOS, Firefox)
    var currentMode       = "chat";
    var voiceSupported    = false;   // MediaRecorder + getUserMedia available
    var voiceStream       = null;    // single mic stream for the session (analyser + recorder)
    var mediaRec          = null;    // MediaRecorder for the current utterance
    var recChunks         = [];      // recorded audio chunks
    var vadSpeaking       = false;   // speech detected in the current utterance
    var vadSilenceStart   = 0;       // when the trailing silence began
    var vadStartedAt      = 0;       // when the current recording started
    var vadRaf            = null;    // voice-activity-detection loop (optional bonus)
    var recTimer          = null;    // safety auto-send timer (analyser-independent guarantee)
    var recStopping       = false;   // guard so one utterance is sent exactly once
    var voiceSawSignal    = false;   // analyser produced real audio this utterance (false = dead analyser)
    var MAX_RECORD_MS     = 15000;   // hard cap per utterance (safety backstop if VAD never fires)
    var voiceActive       = false;   // a voice turn is live (recording → thinking → speaking)
    var voiceState        = "idle";  // idle | listening | thinking | speaking
    var voiceProcessing   = false;   // mic paused while thinking / speaking
    var voiceFinal        = "";
    var voiceInterim      = "";
    var voiceLiveEl       = null;     // persistent element for the in-progress sentence
    var voiceRestartTimer = null;
    var voiceSilenceTimer = null;     // end-of-speech detection (respond only after a real pause)
    var VOICE_SILENCE_MS  = 1000;     // wait ~1.0s of silence before answering (snappier; still a full second so mid-sentence pauses don't trigger)
    var ttsAudio          = null;    // ElevenLabs audio playback element
    var ttsReqId          = 0;       // guards against superseded TTS responses (non-streaming speak())
    // Streaming voice reply: speak sentence 1 while the rest generates (SSE → sequential TTS queue)
    var ttsQueue          = [];      // pending spoken sentences waiting for TTS playback
    var ttsPlaying        = false;   // a queued sentence is currently being fetched/played
    var streamDone        = false;   // the SSE stream has finished (got "done"/"error"/closed)
    var streamGotAny      = false;   // received at least one spoken sentence (else → fall back to /chat)
    var streamAbort       = null;    // AbortController for the in-flight SSE fetch
    var voiceSessionId    = null;    // separate backend session for voice (independent of chat)
    var micMeterCtx       = null;    // Web Audio context for the live waveform
    var micMeterStream    = null;
    var micMeterAnalyser  = null;
    var waveRaf           = null;
    var waveBars          = null;

    // ── Live waveform driven by real microphone volume ──────
    function startMicMeter() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try {
            if (!micMeterCtx) micMeterCtx = new AC();
            if (micMeterCtx.state === "suspended") micMeterCtx.resume();
        } catch (e) { return; }
        if (!waveBars) waveBars = Array.prototype.slice.call(document.querySelectorAll("#voiceWave span"));
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
            if (!voiceActive) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
            micMeterStream = stream;
            var src = micMeterCtx.createMediaStreamSource(stream);
            micMeterAnalyser = micMeterCtx.createAnalyser();
            micMeterAnalyser.fftSize = 64;
            micMeterAnalyser.smoothingTimeConstant = 0.75;
            src.connect(micMeterAnalyser);
            runWaveLoop();
        }).catch(function () {});
    }
    function runWaveLoop() {
        if (waveRaf) cancelAnimationFrame(waveRaf);
        var data = new Uint8Array(micMeterAnalyser ? micMeterAnalyser.frequencyBinCount : 32);
        function tick() {
            if (!voiceActive || !micMeterAnalyser || !waveBars) { waveRaf = null; return; }
            if (voiceState === "listening") {
                micMeterAnalyser.getByteFrequencyData(data);
                for (var i = 0; i < waveBars.length; i++) {
                    var v = data[i + 2] || 0;                 // skip the lowest (rumble) bins
                    var h = 5 + (v / 255) * 30;
                    waveBars[i].style.height = h.toFixed(0) + "px";
                }
            } else {
                for (var j = 0; j < waveBars.length; j++) {
                    if (waveBars[j].style.height) waveBars[j].style.height = "";  // let CSS take over
                }
            }
            waveRaf = requestAnimationFrame(tick);
        }
        tick();
    }
    function stopMicMeter() {
        if (waveRaf) { cancelAnimationFrame(waveRaf); waveRaf = null; }
        if (micMeterStream) { micMeterStream.getTracks().forEach(function (t) { t.stop(); }); micMeterStream = null; }
        micMeterAnalyser = null;
        if (waveBars) waveBars.forEach(function (b) { b.style.height = ""; });
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"]/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
        });
    }

    function setVoiceState(state) {
        voiceState = state;
        if (!voiceView) return;
        voiceView.classList.remove("listening", "thinking", "speaking");
        if (state !== "idle") voiceView.classList.add(state);
        voiceView.classList.toggle("active", voiceActive);
        var vt = VOICE_TEXT[selectedLang] || VOICE_TEXT.cs;
        var st = document.getElementById("voiceStatus");
        if (st) {
            st.textContent =
                state === "listening" ? vt.listening :
                state === "thinking"  ? vt.thinking  :
                state === "speaking"  ? vt.speaking  :
                (voiceSupported ? vt.tapToSpeak : vt.unsupported);
        }
    }

    // Live conversation transcript — incremental (no full re-render = no flicker)
    function clearVoiceConv() {
        var el = document.getElementById("voiceTranscript");
        if (el) el.innerHTML = "";
        voiceLiveEl = null;
    }
    function removeVoiceLive() {
        if (voiceLiveEl && voiceLiveEl.parentNode) voiceLiveEl.parentNode.removeChild(voiceLiveEl);
        voiceLiveEl = null;
    }
    function appendVoiceTurn(role, text) {
        var el = document.getElementById("voiceTranscript");
        if (!el) return;
        removeVoiceLive();
        var row = document.createElement("div");
        row.className = "vt-row vt-row-" + role;   // bot → left, user → right
        var d = document.createElement("div");
        d.className = "vt-turn vt-" + role;
        d.textContent = text;
        var t = document.createElement("div");
        t.className = "vt-time";
        t.textContent = formatTime(Date.now());
        row.appendChild(d);
        row.appendChild(t);
        el.appendChild(row);
        el.scrollTop = el.scrollHeight;
    }
    // Navigate the customer to a product page — works standalone AND when embedded in an iframe on autoaws.cz.
    // In demo mode open a new tab so the presentation page stays open.
    function gotoProduct(url) {
        if (window.TENESCO_DEMO) { window.open(url, "_blank", "noopener"); return; }
        try { (window.top || window).location.href = url; }
        catch (e) { window.location.href = url; }
    }
    // Clickable product buttons inside the voice transcript (voice can't click a spoken URL)
    function appendVoiceLinks(links) {
        var el = document.getElementById("voiceTranscript");
        if (!el || !links || !links.length) return;
        var wrap = document.createElement("div");
        wrap.className = "vt-links";
        links.forEach(function (link) {
            if (!link || !link.url) return;
            var a = document.createElement("button");
            a.type = "button";
            a.className = "vt-link-chip";
            a.innerHTML = '<span class="vt-link-ic">🔗</span><span>' + (link.title || "Zobrazit produkt") + "</span>";
            a.onclick = function () {
                sessionStorage.setItem("eniq_chat_open", "true");
                var overlay = document.createElement("div");
                overlay.className = "page-transition-overlay";
                overlay.innerHTML = '<div class="transition-spinner"></div>';
                document.body.appendChild(overlay);
                setTimeout(function () { overlay.classList.add("active"); }, 10);
                setTimeout(function () { gotoProduct(link.url); }, 450);
            };
            wrap.appendChild(a);
        });
        el.appendChild(wrap);
        el.scrollTop = el.scrollHeight;
    }
    // Update only the in-progress sentence; reuse the same node so it doesn't blink
    function updateVoiceLive(text) {
        var el = document.getElementById("voiceTranscript");
        if (!el) return;
        if (!text) { removeVoiceLive(); return; }
        if (!voiceLiveEl) {
            voiceLiveEl = document.createElement("div");
            voiceLiveEl.className = "vt-turn vt-user vt-live";
            el.appendChild(voiceLiveEl);
        }
        voiceLiveEl.textContent = text;
        el.scrollTop = el.scrollHeight;
    }

    function setupVoiceMode() {
        // Robust cross-browser voice: record audio + transcribe on the server (no flaky Web Speech API)
        voiceSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
    }

    // Pick a recording MIME the browser supports (Chrome → webm/opus, Safari/iOS → mp4)
    function pickRecMime() {
        var opts = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
        if (window.MediaRecorder && MediaRecorder.isTypeSupported) {
            for (var i = 0; i < opts.length; i++) {
                if (MediaRecorder.isTypeSupported(opts[i])) return opts[i];
            }
        }
        return "";
    }

    // Acquire (or reuse) the mic stream, then record one utterance. Tap-to-talk:
    // the user taps to start, taps again to send — works on EVERY device.
    // Sending never depends on the Web-Audio analyser (analyser = cosmetic waveform only).
    function startRecording() {
        if (voiceProcessing) return;
        stopTts();
        if (voiceStream) { beginRec(); return; }      // reuse the live stream → instant turns
        var st0 = document.getElementById("voiceStatus");
        if (st0) st0.textContent = (MIC_TEXT[selectedLang] || MIC_TEXT.cs).starting;
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
            voiceStream = stream;
            ensureAnalyser(stream);
            beginRec();
        }).catch(function () {
            voiceActive = false;
            var st = document.getElementById("voiceStatus");
            if (st) st.textContent = (MIC_TEXT[selectedLang] || MIC_TEXT.cs).denied;
            setVoiceState("idle");
        });
    }

    // Cosmetic live-waveform analyser. Wrapped so a failure can NEVER block recording.
    function ensureAnalyser(stream) {
        var AC = window.AudioContext || window.webkitAudioContext;
        try {
            if (!micMeterCtx && AC) micMeterCtx = new AC();
            if (micMeterCtx && micMeterCtx.state === "suspended") micMeterCtx.resume();
            if (micMeterCtx) {
                var src = micMeterCtx.createMediaStreamSource(stream);
                micMeterAnalyser = micMeterCtx.createAnalyser();
                micMeterAnalyser.fftSize = 1024;
                micMeterAnalyser.smoothingTimeConstant = 0.6;
                src.connect(micMeterAnalyser);
                if (!waveBars) waveBars = Array.prototype.slice.call(document.querySelectorAll("#voiceWave span"));
            }
        } catch (e) { micMeterAnalyser = null; }
    }

    function micError() {
        var ste = document.getElementById("voiceStatus");
        if (ste) ste.textContent = (MIC_TEXT[selectedLang] || MIC_TEXT.cs).error;
        voiceActive = false;
        voiceProcessing = false;
        setVoiceState("idle");
    }

    // Start the MediaRecorder for one turn. Guaranteed to stop+send via:
    //   1) the user tapping the orb again   (primary — always works, any device)
    //   2) a hard safety timer              (analyser-independent)
    //   3) optional silence auto-stop        (bonus — only when the analyser is alive)
    function beginRec() {
        if (!voiceStream) return;
        recChunks = [];
        recStopping = false;
        voiceSawSignal = false;
        vadSpeaking = false; vadSilenceStart = 0; vadStartedAt = Date.now();
        var mime = pickRecMime();
        try {
            mediaRec = mime ? new MediaRecorder(voiceStream, { mimeType: mime }) : new MediaRecorder(voiceStream);
        } catch (e) {
            try { mediaRec = new MediaRecorder(voiceStream); } catch (e2) { micError(); return; }
        }
        mediaRec.ondataavailable = function (ev) { if (ev.data && ev.data.size) recChunks.push(ev.data); };
        mediaRec.onstop = onRecStop;
        try { mediaRec.start(); } catch (e) { micError(); return; }
        voiceActive = true;
        voiceProcessing = false;
        setVoiceState("listening");        // status reads "Poslouchám… · klepněte pro odeslání"
        if (waveBars) runWaveLoop();
        runVad();                          // optional, analyser-gated
        if (recTimer) clearTimeout(recTimer);
        recTimer = setTimeout(function () { stopAndSend(); }, MAX_RECORD_MS);
    }

    // Optional convenience: auto-send after a clear pause IF the analyser is alive.
    // Never the only path — tap + safety timer always guarantee a send.
    function runVad() {
        if (vadRaf) cancelAnimationFrame(vadRaf);
        if (!micMeterAnalyser) return;     // analyser dead → rely on tap / safety timer
        var buf = new Uint8Array(micMeterAnalyser.fftSize || 1024);
        var SPEAK = 0.014;                 // RMS threshold counted as speech
        var MIN_SPEECH_MS = 350;           // ignore tiny blips
        var END_SILENCE_MS = 1000;         // pause that ends a turn — enough that a mid-thought pause doesn't cut you off
        var speechAccum = 0, lastT = Date.now();
        function tick() {
            if (recStopping || !voiceActive || voiceProcessing || !mediaRec || mediaRec.state !== "recording" || !micMeterAnalyser) { vadRaf = null; return; }
            micMeterAnalyser.getByteTimeDomainData(buf);
            var sum = 0;
            for (var i = 0; i < buf.length; i++) { var v = (buf[i] - 128) / 128; sum += v * v; }
            var rms = Math.sqrt(sum / buf.length);
            if (rms > 0.004) voiceSawSignal = true;   // analyser is producing real audio (not flatlined)
            var t = Date.now(), dt = t - lastT; lastT = t;
            if (rms > SPEAK) {
                speechAccum += dt;
                if (speechAccum > MIN_SPEECH_MS) vadSpeaking = true;
                vadSilenceStart = 0;
            } else if (vadSpeaking) {
                if (!vadSilenceStart) vadSilenceStart = t;
                else if (t - vadSilenceStart > END_SILENCE_MS) { stopAndSend(); return; }
            }
            vadRaf = requestAnimationFrame(tick);
        }
        tick();
    }

    // Stop the current recording and send it (idempotent — runs once per turn).
    function stopAndSend() {
        if (recStopping) return;
        recStopping = true;
        if (recTimer) { clearTimeout(recTimer); recTimer = null; }
        if (vadRaf) { cancelAnimationFrame(vadRaf); vadRaf = null; }
        try {
            if (mediaRec && mediaRec.state === "recording") mediaRec.stop();   // → onRecStop
            else onRecStop();
        } catch (e) { onRecStop(); }
    }

    function onRecStop() {
        if (!recChunks.length) { relisten(); return; }   // nothing captured → keep listening
        // Analyser is alive but heard only silence/noise (no real speech) → skip the STT call
        // and keep listening. When the analyser is DEAD voiceSawSignal stays false and we DO
        // send the recording — so a broken/suspended analyser can never cause the old hang.
        if (voiceSawSignal && !vadSpeaking) { relisten(); return; }
        voiceProcessing = true;
        setVoiceState("thinking");
        var blob = new Blob(recChunks, { type: (mediaRec && mediaRec.mimeType) || "audio/webm" });
        recChunks = [];
        transcribeAndAnswer(blob);
    }

    // Resume listening if the conversation is still on, otherwise settle to idle.
    function relisten() {
        voiceProcessing = false;
        if (voiceActive) startRecording();
        else setVoiceState("idle");
    }

    function transcribeAndAnswer(blob) {
        fetch(BASE_URL + "/stt?lang=" + encodeURIComponent(selectedLang), {
            method: "POST",
            headers: { "Content-Type": blob.type || "audio/webm", "X-CSRF-Token": csrfToken || "" },
            body: blob
        })
        .then(function (r) { return r.json(); })
        .then(function (d) {
            var q = (d && d.text ? d.text : "").trim();
            if (!q) { relisten(); return; }   // nothing recognised → keep listening
            handleVoiceQuery(q);
        })
        .catch(function () { relisten(); });   // transient STT error → keep listening
    }

    // Full stop: Stop button / close / leaving voice mode. Releases the mic.
    function stopVoiceSession() {
        voiceActive = false;
        voiceProcessing = false;
        recStopping = true;
        ttsReqId++;   // invalidate any in-flight TTS
        if (streamAbort) { try { streamAbort.abort(); } catch (e) {} streamAbort = null; }   // stop the SSE stream
        ttsQueue = []; ttsPlaying = false; streamDone = true;                                 // drop queued sentences
        if (recTimer) { clearTimeout(recTimer); recTimer = null; }
        if (voiceRestartTimer) { clearTimeout(voiceRestartTimer); voiceRestartTimer = null; }
        if (vadRaf) { cancelAnimationFrame(vadRaf); vadRaf = null; }
        try { if (mediaRec && mediaRec.state === "recording") mediaRec.stop(); } catch (e) {}
        mediaRec = null;
        recChunks = [];
        if (voiceStream) { try { voiceStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} voiceStream = null; }
        stopTts();
        stopMicMeter();
        setVoiceState("idle");
    }

    // Orb tap = start / stop the hands-free conversation. While running it listens →
    // auto-sends on a pause → answers → listens again, until the user taps to stop.
    function toggleVoiceListening() {
        if (!voiceSupported) {
            var su = document.getElementById("voiceStatus");
            if (su) su.textContent = (VOICE_TEXT[selectedLang] || VOICE_TEXT.cs).unsupported;
            return;
        }
        if (voiceActive) { stopVoiceSession(); return; }   // tap while running → stop the whole session
        primeAudioContext();                               // resume audio INSIDE the gesture (reliable VAD)
        voiceActive = true;
        startRecording();                                  // begin the continuous conversation
    }

    // Resume the AudioContext synchronously inside the user's tap. THIS is the fix for the
    // "mic doesn't react" hang: if resume() runs later (in the async getUserMedia callback)
    // the browser can keep the context suspended → the VAD analyser reads silence forever.
    function primeAudioContext() {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try {
            if (!micMeterCtx) micMeterCtx = new AC();
            if (micMeterCtx.state === "suspended") micMeterCtx.resume();
        } catch (e) {}
    }

    function findVoiceAnswer(text) {
        var low = (text || "").toLowerCase();
        var answers = INSTANT_ANSWERS[selectedLang] || INSTANT_ANSWERS.cs;
        for (var key in VOICE_KEYWORDS) {
            if (!VOICE_KEYWORDS.hasOwnProperty(key)) continue;
            var arr = VOICE_KEYWORDS[key];
            for (var i = 0; i < arr.length; i++) {
                if (low.indexOf(arr[i]) !== -1) return answers[key];
            }
        }
        return (VOICE_TEXT[selectedLang] || VOICE_TEXT.cs).fallback;
    }

    function handleVoiceQuery(q) {
        voiceProcessing = true;                                   // mic recording already stopped
        voiceActive = true;
        appendVoiceTurn("user", q);                               // stays only in the voice transcript
        setVoiceState("thinking");
        // Smooth single-utterance playback (one clean TTS render). Per-sentence streaming was
        // disabled — it made the reply choppy (a gap + prosody break between sentences). Speed
        // comes from the fast Groq brain instead. streamVoiceReply() is kept dormant for reference.
        handleVoiceQueryFallback(q);
    }

    // Sequential TTS playback queue (so streamed sentences play in order without overlap).
    function enqueueTts(sentence) {
        if (!sentence) return;
        ttsQueue.push(sentence);
        if (!ttsPlaying) playNextTts();
    }
    function playNextTts() {
        if (!voiceActive) { ttsQueue = []; ttsPlaying = false; return; }
        if (!ttsQueue.length) {
            ttsPlaying = false;
            if (streamDone) finishSpeaking();                     // everything spoken + stream finished → listen again
            return;
        }
        ttsPlaying = true;
        var sentence = ttsQueue.shift();
        fetch(BASE_URL + "/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken || "" },
            body: JSON.stringify({ text: sentence, language: selectedLang })
        })
        .then(function (r) { if (!r.ok) throw new Error("tts " + r.status); return r.blob(); })
        .then(function (blob) {
            if (!voiceActive) { ttsPlaying = false; return; }
            var objUrl = URL.createObjectURL(blob);
            if (!ttsAudio) ttsAudio = new Audio();
            ttsAudio.src = objUrl;
            ttsAudio.onplaying = function () { if (voiceActive) setVoiceState("speaking"); };
            ttsAudio.onended = function () { URL.revokeObjectURL(objUrl); playNextTts(); };
            ttsAudio.onerror = function () { URL.revokeObjectURL(objUrl); playNextTts(); };
            var p = ttsAudio.play();
            if (p && p.catch) p.catch(function () { playNextTts(); });
        })
        .catch(function () { playNextTts(); });                   // skip a failed sentence, keep the conversation flowing
    }

    // Stream the reply; speak each sentence as it arrives. Falls back to non-streaming /chat on any failure.
    function streamVoiceReply(q) {
        ttsQueue = []; ttsPlaying = false; streamDone = false; streamGotAny = false;
        streamAbort = (typeof AbortController !== "undefined") ? new AbortController() : null;
        var didFallback = false;
        function doFallback() { if (!didFallback) { didFallback = true; handleVoiceQueryFallback(q); } }

        if (!window.ReadableStream) { doFallback(); return; }     // very old browser → no streaming

        fetch(BASE_URL + "/chat-voice-stream", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken || "" },
            body: JSON.stringify({ message: q, session_id: voiceSessionId, language: selectedLang }),
            signal: streamAbort ? streamAbort.signal : undefined
        })
        .then(function (r) {
            if (!r.ok || !r.body || !r.body.getReader) throw new Error("no-stream");
            var reader = r.body.getReader(), dec = new TextDecoder(), buf = "";
            function pump() {
                return reader.read().then(function (res) {
                    if (res.done) {
                        streamDone = true;
                        if (!streamGotAny) doFallback();
                        else if (!ttsPlaying && !ttsQueue.length) finishSpeaking();
                        return;
                    }
                    buf += dec.decode(res.value, { stream: true });
                    var idx;
                    while ((idx = buf.indexOf("\n\n")) !== -1) {
                        var frame = buf.slice(0, idx); buf = buf.slice(idx + 2);
                        var parts = frame.split("\n"), dl = null;
                        for (var i = 0; i < parts.length; i++) { if (parts[i].indexOf("data:") === 0) { dl = parts[i]; break; } }
                        if (!dl) continue;
                        var obj; try { obj = JSON.parse(dl.slice(5).trim()); } catch (e) { continue; }
                        handleStreamEvent(obj);
                    }
                    return pump();
                });
            }
            return pump();
        })
        .catch(function (e) {
            if (e && e.name === "AbortError") return;             // user stopped → nothing to do
            if (!streamGotAny) doFallback();                      // never produced audio → fall back to /chat
        });
    }

    function handleStreamEvent(obj) {
        if (!obj || !obj.t || !voiceActive) return;
        if (obj.t === "start") { if (obj.session_id) voiceSessionId = obj.session_id; return; }
        if (obj.t === "say") { streamGotAny = true; enqueueTts(obj.s); return; }
        if (obj.t === "done") {
            streamDone = true;
            if (obj.text) { streamGotAny = true; appendVoiceTurn("bot", obj.text); }
            if (obj.links && obj.links.length) appendVoiceLinks(obj.links);
            if (!ttsPlaying && !ttsQueue.length) finishSpeaking();
            return;
        }
        if (obj.t === "error") { streamDone = true; }             // brain failed → pump's "done" triggers fallback
    }

    // Non-streaming fallback (original flow). Does NOT re-append the user turn (caller already did).
    function handleVoiceQueryFallback(q) {
        setVoiceState("thinking");
        fetch(BASE_URL + "/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken || "" },
            body: JSON.stringify({ message: q, session_id: voiceSessionId, language: selectedLang, mode: "voice" })
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (!voiceActive) { voiceProcessing = false; return; }
            if (data && data.session_id) voiceSessionId = data.session_id;
            var answer = (data && data.response) ? data.response : findVoiceAnswer(q);
            appendVoiceTurn("bot", answer);
            if (data && data.recommended_links) appendVoiceLinks(data.recommended_links);
            speak(answer);
        })
        .catch(function () {
            if (!voiceActive) { voiceProcessing = false; return; }
            var answer = findVoiceAnswer(q);
            appendVoiceTurn("bot", answer);
            speak(answer);
        });
    }

    // The reply finished → resume listening (continuous) after a short settle delay,
    // so the mic doesn't catch the tail of the spoken answer. Stays on until the user taps to stop.
    function finishSpeaking() {
        voiceProcessing = false;
        if (!voiceActive) { setVoiceState("idle"); return; }
        if (voiceRestartTimer) clearTimeout(voiceRestartTimer);
        voiceRestartTimer = setTimeout(function () { if (voiceActive) startRecording(); }, 300);
    }

    function stopTts() {
        if (ttsAudio) {
            try { ttsAudio.pause(); } catch (e) {}
            try { ttsAudio.removeAttribute("src"); ttsAudio.load(); } catch (e) {}
        }
    }

    // Speak with a realistic free neural voice (Microsoft Edge TTS, served via /tts proxy)
    function speak(text) {
        var myId = ++ttsReqId;
        stopTts();
        fetch(BASE_URL + "/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken || "" },
            body: JSON.stringify({ text: text, language: selectedLang })
        })
        .then(function (r) { if (!r.ok) throw new Error("tts " + r.status); return r.blob(); })
        .then(function (blob) {
            if (myId !== ttsReqId || !voiceActive) return;   // superseded or session ended
            var objUrl = URL.createObjectURL(blob);
            if (!ttsAudio) ttsAudio = new Audio();
            ttsAudio.src = objUrl;
            ttsAudio.onplaying = function () { if (myId === ttsReqId) setVoiceState("speaking"); };
            ttsAudio.onended = function () { URL.revokeObjectURL(objUrl); if (myId === ttsReqId) finishSpeaking(); };
            ttsAudio.onerror = function () { URL.revokeObjectURL(objUrl); if (myId === ttsReqId) finishSpeaking(); };
            var p = ttsAudio.play();
            if (p && p.catch) p.catch(function () { if (myId === ttsReqId) finishSpeaking(); });
        })
        .catch(function () { if (myId === ttsReqId) finishSpeaking(); });
    }

    function switchMode(mode) {
        currentMode = mode;
        if (mode === "voice") {
            panel.classList.add("voice-mode");
            setVoiceState("idle");
        } else {
            panel.classList.remove("voice-mode");
            stopVoiceSession();
        }
        if (modeChatBtn) modeChatBtn.classList.toggle("active", mode === "chat");
        if (modeVoiceBtn) modeVoiceBtn.classList.toggle("active", mode === "voice");
        if (emojiPanel) emojiPanel.classList.remove("open");
    }

    function refreshVoiceTexts() {
        var vt = VOICE_TEXT[selectedLang] || VOICE_TEXT.cs;
        var mc = document.getElementById("modeChatLabel");  if (mc) mc.textContent = vt.modeChat;
        var mv = document.getElementById("modeVoiceLabel"); if (mv) mv.textContent = vt.modeVoice;
        if (voiceState === "idle") {
            var st = document.getElementById("voiceStatus");
            if (st) st.textContent = voiceSupported ? vt.tapToSpeak : vt.unsupported;
        }
    }

    // ── Invite popup (smart, one-time invitation) ────────────
    function fillInviteTexts() {
        var it = INVITE_TEXT[selectedLang] || INVITE_TEXT.cs;
        var t = document.getElementById("inviteText");   if (t) t.textContent = it.greeting;
        var c = document.getElementById("inviteCtaLabel"); if (c) c.textContent = it.cta;
        var o = document.getElementById("inviteOnline");  if (o) o.textContent = it.online;
    }
    function showBadge() {
        if (badge) badge.classList.add("show");
    }
    function nudgeLauncher() {
        var l = document.getElementById("chatLauncher");
        if (!l) return;
        l.classList.remove("nudge");
        // reflow so the animation can re-trigger
        void l.offsetWidth;
        l.classList.add("nudge");
        setTimeout(function () { l.classList.remove("nudge"); }, 700);
    }
    function showInvite() {
        if (!invitePopup) return;
        if (isOpen()) return;
        if (sessionStorage.getItem("tenesco_opened") === "1") return;
        if (sessionStorage.getItem("tenesco_invite_seen") === "1") return;
        sessionStorage.setItem("tenesco_invite_seen", "1");
        invitePopup.classList.add("open");
        showBadge();
        nudgeLauncher();
        playNotify();
        // No auto-close — the popup stays until the customer closes it (×) or opens the chat.
    }
    // keepBadge=true → popup closes but the red "1" keeps glowing until the user opens the chat
    function closeInvite(keepBadge) {
        if (inviteAutoTimer) { clearTimeout(inviteAutoTimer); inviteAutoTimer = null; }
        if (invitePopup) invitePopup.classList.remove("open");
        if (!keepBadge && badge) badge.classList.remove("show");
    }
    function scheduleInvite() {
        if (sessionStorage.getItem("tenesco_opened") === "1") return;
        // already invited this visit → keep the badge glowing as a reminder, no popup
        if (sessionStorage.getItem("tenesco_invite_seen") === "1") { showBadge(); return; }
        if (inviteTimer) clearTimeout(inviteTimer);
        inviteTimer = setTimeout(showInvite, 10000);  // 10s after entering the site
    }

    // ── Open / Close ────────────────────────────────────────
    function isOpen() {
        return panel.classList.contains("open");
    }

    function openChat() {
        panel.classList.add("open");
        sessionStorage.setItem("eniq_chat_open", "true");
        sessionStorage.setItem("tenesco_opened", "1");
        audioUnlocked = true;
        badge.classList.remove("show");
        if (inviteTimer) { clearTimeout(inviteTimer); inviteTimer = null; }
        closeInvite();

        if (chatBox.children.length === 0) {
            showConsentBannerIfNeeded();
            addMessage(UI_TEXT[selectedLang].welcomeHtml, "bot", false, false, false, null, true, null, true);
            saveMessageToHistory(UI_TEXT[selectedLang].welcome, "bot", Date.now(), true);
            showQuickActionsInChat();
        }
    }

    function closeChat() {
        // Always release the mic on close — between turns voiceActive is false but the
        // stream stays alive for instant turns, so guard on the stream too (no leak).
        if (voiceStream || voiceActive) stopVoiceSession();
        panel.classList.remove("open");
        sessionStorage.setItem("eniq_chat_open", "false");
    }

    // Close-confirm dialog (shown when the user closes while voice is running)
    function showCloseConfirm() {
        var ct = CONFIRM_TEXT[selectedLang] || CONFIRM_TEXT.cs;
        var m = document.getElementById("vcMsg"); if (m) m.textContent = ct.msg;
        var k = document.getElementById("vcKeep"); if (k) k.textContent = ct.keep;
        var e = document.getElementById("vcEnd"); if (e) e.textContent = ct.end;
        var c = document.getElementById("voiceCloseConfirm"); if (c) c.classList.add("open");
    }
    function hideCloseConfirm() {
        var c = document.getElementById("voiceCloseConfirm"); if (c) c.classList.remove("open");
    }
    // Called by the header × — asks first if the voice session is active
    function requestClose() {
        if (voiceActive) { showCloseConfirm(); return; }
        closeChat();
    }

    // ── Settings ────────────────────────────────────────────
    function setLang(lang) {
        selectedLang = lang;
        localStorage.setItem("eniq_lang", lang);
        if (input) input.placeholder = UI_TEXT[lang].placeholder;
        if (langSelect) langSelect.value = lang;

        var expandLabel = document.getElementById("expandLabel");
        if (expandLabel) expandLabel.textContent = UI_TEXT[lang].expandLabel;

        var themeLabel = document.getElementById("themeLabel");
        if (themeLabel) themeLabel.textContent = UI_TEXT[lang].themeLabel;

        var ex = EXTRA_TEXT[lang] || EXTRA_TEXT.cs;
        var animLabelEl = document.getElementById("animLabel");
        if (animLabelEl) animLabelEl.textContent = ex.animLabel;
        var soundLabelEl = document.getElementById("soundLabel");
        if (soundLabelEl) soundLabelEl.textContent = ex.soundLabel;
        var fontLabelEl = document.getElementById("fontLabel");
        if (fontLabelEl) fontLabelEl.textContent = ex.fontLabel;
        var langLabelEl = document.getElementById("langLabelText");
        if (langLabelEl) langLabelEl.textContent = ex.langLabel2;
        var clearBtnEl = document.getElementById("clearChatBtn");
        if (clearBtnEl) clearBtnEl.textContent = ex.clearLabel;
        if (recognition && !listening) recognition.lang = LANG_CODE[lang] || "cs-CZ";
        fillConsentTexts();
        refreshVoiceTexts();
        fillInviteTexts();

        if (chatBox) {
            var savedData = sessionStorage.getItem("eniq_chat_history");
            var history = savedData ? JSON.parse(savedData) : [];
            var hasUserMessage = history.some(function (msg) { return msg.sender === "user"; });

            if (!hasUserMessage && chatBox.children.length > 0) {
                chatBox.innerHTML = "";
                sessionStorage.removeItem("eniq_chat_history");
                quickActionsShown = false;
                addMessage(UI_TEXT[lang].welcomeHtml, "bot", false, false, false, null, true, null, true);
                saveMessageToHistory(UI_TEXT[lang].welcome, "bot", Date.now(), true);
                showQuickActionsInChat();
            }
        }
    }

    function setExpanded(expanded) {
        isExpanded = expanded;
        localStorage.setItem("eniq_expanded", expanded.toString());
        if (panel) {
            if (expanded) panel.classList.add("expanded");
            else panel.classList.remove("expanded");
        }
        if (expandToggle) {
            if (expanded) expandToggle.classList.add("active");
            else expandToggle.classList.remove("active");
        }
    }

    function setTheme(dark) {
        isDarkMode = dark;
        localStorage.setItem("eniq_theme", dark ? "dark" : "light");
        if (panel) {
            if (dark) panel.classList.add("dark-mode");
            else panel.classList.remove("dark-mode");
        }
        if (themeToggle) {
            if (dark) themeToggle.classList.add("active");
            else themeToggle.classList.remove("active");
        }
        if (invitePopup) invitePopup.classList.toggle("invite-dark", dark);
    }

    // ── Global click handler ────────────────────────────────
    function handleGlobalClick(e) {
        var target = e.target;

        if (target.closest("#chatLauncher")) {
            if (!isOpen()) openChat();
        } else if (target.closest("#inviteCta")) {
            if (!isOpen()) openChat();
        } else if (target.closest("#inviteClose")) {
            closeInvite(true);
        } else if (target.closest("#closeBtn")) {
            requestClose();
        } else if (target.closest("#vcKeep")) {
            hideCloseConfirm();
        } else if (target.closest("#vcEnd")) {
            hideCloseConfirm();
            stopVoiceSession();
            closeChat();
        } else if (target.closest("#voiceStopBtn")) {
            stopVoiceSession();
        } else if (target.closest("#sendBtn")) {
            submitComposer();
        } else if (target.closest("#attachBtn")) {
            if (fileInput) fileInput.click();
        } else if (target.closest("#emojiBtn")) {
            toggleEmojiPanel();
        } else if (target.closest("#voiceBtn")) {
            toggleVoice();
        } else if (target.closest("#modeChatBtn")) {
            switchMode("chat");
        } else if (target.closest("#modeVoiceBtn")) {
            switchMode("voice");
        } else if (target.closest("#voiceOrb")) {
            toggleVoiceListening();
        } else if (target.closest(".emoji-item")) {
            insertEmoji(target.closest(".emoji-item").dataset.emoji);
        } else if (target.closest(".attach-remove")) {
            removeAttachment(parseInt(target.closest(".attach-remove").dataset.index, 10));
        } else if (target.closest("#consentOk")) {
            dismissConsent();
        } else if (target.closest("#consentLink")) {
            if (consentBox) consentBox.classList.toggle("open");
        } else if (target.closest("#clearChatBtn")) {
            clearConversation();
        } else if (target.closest(".quick-action-btn")) {
            var qaBtn = target.closest(".quick-action-btn");
            var action = qaBtn.dataset.action;
            var answers = INSTANT_ANSWERS[selectedLang] || INSTANT_ANSWERS.cs;
            var actionAns = answers[action] || INSTANT_ANSWERS.cs[action];
            if (actionAns) {
                var labelEl = qaBtn.querySelector(".qa-label");
                addMessage(labelEl ? labelEl.textContent : qaBtn.textContent.trim(), "user", false, true);
                showSearching();
                setTimeout(function () {
                    removeSearching();
                    addMessage(actionAns, "bot", true, true, true);
                }, 650);
            }
        } else if (target.closest("#settingsBtn")) {
            settingsMenu.classList.toggle("active");
        } else if (target.closest("#expandToggle")) {
            setExpanded(!isExpanded);
        } else if (target.closest("#themeToggle")) {
            setTheme(!isDarkMode);
        } else if (target.closest("#animToggle")) {
            setAnim(!animEnabled);
        } else if (target.closest("#soundToggle")) {
            setSound(!soundEnabled);
        }

        // Close settings if click outside
        if (settingsMenu && settingsMenu.classList.contains("active") &&
            !target.closest("#settingsMenu") && !target.closest("#settingsBtn")) {
            settingsMenu.classList.remove("active");
        }
        // Close emoji panel if click outside
        if (emojiPanel && emojiPanel.classList.contains("open") &&
            !target.closest("#emojiPanel") && !target.closest("#emojiBtn")) {
            emojiPanel.classList.remove("open");
        }
    }

    document.addEventListener("click", handleGlobalClick);
    input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submitComposer();
        }
    });
    input.addEventListener("input", function () {
        autoGrowInput();
        updateSendState();
    });
    langSelect.addEventListener("change", function (e) {
        setLang(e.target.value);
    });
    if (fontSelect) fontSelect.addEventListener("change", function (e) {
        setFont(e.target.value);
    });
    if (fileInput) fileInput.addEventListener("change", function (e) {
        handleFiles(e.target.files);
        fileInput.value = "";
    });

    // Unlock audio on first user gesture so the invite chime can play
    ["pointerdown", "keydown", "touchstart"].forEach(function (ev) {
        document.addEventListener(ev, unlockAudio, { once: true, passive: true });
    });

    // ── Init ────────────────────────────────────────────────
    buildEmojiPanel();
    setupVoice();
    setupVoiceMode();
    setTheme(isDarkMode);
    setExpanded(isExpanded);
    setSound(soundEnabled);
    setAnim(animEnabled);
    setFont(fontSize);
    setLang(selectedLang);
    switchMode("chat");
    updateSendState();

    // Restore chat if was open before navigation
    if (sessionStorage.getItem("eniq_chat_open") === "true") {
        openChat();
        var savedHistory = sessionStorage.getItem("eniq_chat_history");
        if (savedHistory) {
            var history = JSON.parse(savedHistory);
            chatBox.innerHTML = "";
            quickActionsShown = false;
            history.forEach(function (msg) {
                addMessage(msg.text, msg.sender, false, false, false, null, false, msg.time, msg.noTime);
            });
        }
    } else {
        // Smart invitation: show the popup 10s after entering, unless opened first
        scheduleInvite();
    }
})();
