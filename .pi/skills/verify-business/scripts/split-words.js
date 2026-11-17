// Injected into a page by flows: window.__splitWords() lists every visible word the layout breaks mid-word.
(() => {
    const NATURAL_BREAK_AFTER = new Set([
        "-",
        "/",
        "–",
        "—",
        "\u00ad",
        "_",
        ".",
    ]);
    const CJK =
        /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/u;

    const rangeRects = (node, start, end) => {
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, end);
        return [...range.getClientRects()].filter((r) => r.width > 0.5);
    };

    const lineOf = (node, i) => {
        const [rect] = rangeRects(node, i, i + 1);
        return rect ? Math.round(rect.top + rect.height / 2) : null;
    };

    const classify = (token) => {
        const core = token.replace(/^[("«“'’]+|[)"»”'’.,;:!?…]+$/gu, "");
        if (CJK.test(core)) return "cjk";
        if (/^[\p{L}\p{M}'’]+$/u.test(core)) return "word";
        if (/^[\d\s.,]+$/u.test(core)) return "number";
        return "token";
    };

    const path = (el) => {
        const parts = [];
        for (
            let e = el;
            e && e !== document.body && parts.length < 4;
            e = e.parentElement
        ) {
            const cls =
                typeof e.className === "string"
                    ? e.className.trim().split(/\s+/)[0]
                    : "";
            parts.unshift(
                e.tagName.toLowerCase() + (cls ? `.${cls.slice(0, 40)}` : "")
            );
        }
        return parts.join(" > ");
    };

    const isVisibleText = (el) =>
        el &&
        !/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(el.tagName) &&
        el.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true });

    // Character offsets inside the token where a new line starts, skipping breaks after a hyphen, slash, dot…
    const breakOffsets = (node, start, token) => {
        const breaks = [];
        let prev = lineOf(node, start);
        for (let i = 1; i < token.length; i++) {
            const cur = lineOf(node, start + i);
            const newLine =
                cur !== null && prev !== null && Math.abs(cur - prev) > 2;
            if (newLine && !NATURAL_BREAK_AFTER.has(token[i - 1]))
                breaks.push(i);
            if (cur !== null) prev = cur;
        }
        return breaks;
    };

    const splitTokens = (node) => {
        const found = [];
        for (const match of node.data.matchAll(/\S+/g)) {
            const token = match[0];
            if (token.length < 2) continue;
            const tops = new Set(
                rangeRects(node, match.index, match.index + token.length).map(
                    (r) => Math.round(r.top)
                )
            );
            if (tops.size < 2) continue;
            const breaks = breakOffsets(node, match.index, token);
            if (breaks.length) found.push({ token, breaks });
        }
        return found;
    };

    window.__splitWords = () => {
        const out = new Map();
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT
        );
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const el = node.parentElement;
            if (!isVisibleText(el)) continue;
            for (const { token, breaks } of splitTokens(node)) {
                const word =
                    token.length > 60 ? `${token.slice(0, 57)}…` : token;
                const where = path(el);
                out.set(`${word}|${where}`, {
                    cls: classify(token),
                    word,
                    at: breaks
                        .map(
                            (i) =>
                                `${token.slice(Math.max(0, i - 6), i)}|${token.slice(i, i + 6)}`
                        )
                        .join(" "),
                    box: Math.round(el.getBoundingClientRect().width),
                    path: where,
                });
            }
        }
        return [...out.values()];
    };
})();
