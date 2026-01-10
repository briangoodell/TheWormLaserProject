(function () {
    const SEL = ".cycler";
    const DELAY = 170; // should be >= CSS transition time

    function parseOptions(el) {
    // Prefer JSON in data-options-json if present; otherwise CSV-ish in data-options
    if (el.dataset.optionsJson) {
        try { return JSON.parse(el.dataset.optionsJson); } catch (_) {}
    }
    const raw = el.dataset.options || "";
    return raw.split(";").map(s => s.trim()).filter(Boolean);
    }

    function initCycler(el) {
    const options = parseOptions(el);
    if (!options.length) return;

    // Accessibility
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-label", "Click me :)");
    el.setAttribute("title", "Click me :)");

    // Initial index: match current text if possible
    const current = el.textContent.trim();
    let i = Math.max(0, options.indexOf(current));
    el.textContent = options[i];

    function advance() {
        el.classList.add("is-swapping");
        window.setTimeout(() => {
        i = (i + 1) % options.length;
        el.textContent = options[i];
        el.classList.remove("is-swapping");
        }, DELAY);
    }

    el.addEventListener("click", advance);
    el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        advance();
        }
    });
    }

    document.querySelectorAll(SEL).forEach(initCycler);
})();