import Decimal from "decimal.js";
import { type PDFFont, type PDFPage, type RGB, rgb } from "pdf-lib";

/**
 * Stablecoin → fiat presentation. Documents are merchant-facing legal papers:
 * they show the fiat equivalent of every amount (EUR/€, GBP/£, USD/$), never
 * the crypto token symbol or on-chain address. All stablecoins are pegged 1:1
 * to their fiat leg, so a token amount is already its fiat equivalent.
 */
const FIAT_BY_STABLECOIN: Record<string, { code: string; symbol: string }> = {
    eure: { code: "EUR", symbol: "€" },
    gbpe: { code: "GBP", symbol: "£" },
    usde: { code: "USD", symbol: "$" },
    usdc: { code: "USD", symbol: "$" },
};

export function fiatFor(currency: string): { code: string; symbol: string } {
    return (
        FIAT_BY_STABLECOIN[currency.toLowerCase()] ?? {
            code: currency.toUpperCase(),
            symbol: currency.toUpperCase(),
        }
    );
}

/** VAT + Frak-fee rates used for the reward-table display math (§4). */
export const VAT_RATE = new Decimal("0.20");
export const FRAK_FEE_RATE = new Decimal("0.20");

export const PAGE_WIDTH = 595.28; // A4 @ 72dpi
export const PAGE_HEIGHT = 841.89;
export const MARGIN = 50;
export const DARK = rgb(0.13, 0.13, 0.13);
export const GRAY = rgb(0.45, 0.45, 0.45);
export const WHITE = rgb(1, 1, 1);
/** Frak brand blue (#0043EF) — the badge background. */
export const BRAND_BLUE = rgb(0x00 / 255, 0x43 / 255, 0xef / 255);
/** Rendered size (points) of the square brand badge in the document header. */
export const LOGO_SIZE = 30;

/**
 * The WinAnsi (CP-1252) "extra" glyphs that live in the 0x80–0x9F byte range,
 * which Unicode maps to code points OUTSIDE the Latin-1 (<= 0xFF) block. These
 * are encodable by pdf-lib's StandardFonts even though their code points are
 * > 0xFF, so they must be whitelisted explicitly. Notably includes € (U+20AC)
 * and … (U+2026), which appear on money documents.
 */
const WIN_ANSI_HIGH_CODE_POINTS = new Set<number>([
    0x20ac, // € EURO SIGN
    0x201a, // ‚ SINGLE LOW-9 QUOTATION MARK
    0x0192, // ƒ LATIN SMALL LETTER F WITH HOOK
    0x201e, // „ DOUBLE LOW-9 QUOTATION MARK
    0x2026, // … HORIZONTAL ELLIPSIS
    0x2020, // † DAGGER
    0x2021, // ‡ DOUBLE DAGGER
    0x02c6, // ˆ MODIFIER LETTER CIRCUMFLEX ACCENT
    0x2030, // ‰ PER MILLE SIGN
    0x0160, // Š LATIN CAPITAL LETTER S WITH CARON
    0x2039, // ‹ SINGLE LEFT-POINTING ANGLE QUOTATION MARK
    0x0152, // Œ LATIN CAPITAL LIGATURE OE
    0x017d, // Ž LATIN CAPITAL LETTER Z WITH CARON
    0x2018, // ' LEFT SINGLE QUOTATION MARK
    0x2019, // ' RIGHT SINGLE QUOTATION MARK
    0x201c, // " LEFT DOUBLE QUOTATION MARK
    0x201d, // " RIGHT DOUBLE QUOTATION MARK
    0x2022, // • BULLET
    0x2013, // – EN DASH
    0x2014, // — EM DASH
    0x02dc, // ˜ SMALL TILDE
    0x2122, // ™ TRADE MARK SIGN
    0x0161, // š LATIN SMALL LETTER S WITH CARON
    0x203a, // › SINGLE RIGHT-POINTING ANGLE QUOTATION MARK
    0x0153, // œ LATIN SMALL LIGATURE OE
    0x017e, // ž LATIN SMALL LETTER Z WITH CARON
    0x0178, // Ÿ LATIN CAPITAL LETTER Y WITH DIAERESIS
]);

/**
 * The five bytes in the 0x80–0x9F range that CP-1252 leaves UNDEFINED — they
 * have no glyph and pdf-lib's StandardFonts cannot encode them, so despite
 * being <= 0xFF they must be replaced with "?" like any other unmappable char.
 */
const WIN_ANSI_UNDEFINED_LOW_CODE_POINTS = new Set<number>([
    0x81, 0x8d, 0x8f, 0x90, 0x9d,
]);

/**
 * Sanitizes text to the glyph set pdf-lib's StandardFonts (WinAnsi / CP-1252)
 * can encode, replacing anything else with "?" rather than throwing at draw
 * time. Kept characters:
 *   - Latin-1 (<= 0xFF), EXCEPT the five CP-1252-undefined bytes
 *     (0x81, 0x8D, 0x8F, 0x90, 0x9D);
 *   - the CP-1252 "extra" glyphs whose Unicode code points sit above 0xFF
 *     (€, …, curly quotes, dashes, …) — see `WIN_ANSI_HIGH_CODE_POINTS`.
 * Everything else (emoji, CJK, exotic symbols…) becomes "?".
 *
 * Exported for unit testing.
 */
export function sanitizeForWinAnsi(input: string): string {
    let out = "";
    for (const ch of input) {
        const code = ch.codePointAt(0) ?? 0;
        if (code <= 0xff) {
            out += WIN_ANSI_UNDEFINED_LOW_CODE_POINTS.has(code) ? "?" : ch;
        } else {
            out += WIN_ANSI_HIGH_CODE_POINTS.has(code) ? ch : "?";
        }
    }
    return out;
}

/**
 * Formats a frozen decimal string for display only (fr-FR thousands + 2dp,
 * fiat symbol). Never used for math. Shows the fiat equivalent of the
 * stablecoin amount — the crypto token symbol/address is never printed.
 */
export function formatMoney(value: string, currency: string): string {
    const fiat = fiatFor(currency);
    const n = Number.parseFloat(value);
    const formatted = Number.isFinite(n)
        ? n.toLocaleString("fr-FR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
          })
        : value;
    // Intl may group fr-FR digits with a narrow no-break space (U+202F) that
    // isn't WinAnsi-encodable; normalize it (and NBSP) to a plain space before
    // the glyph-sanitize step would otherwise turn it into "?".
    const normalized = formatted.replace(/[\u00a0\u202f]/g, " ");
    return `${normalized} ${fiat.symbol}`;
}

export function isVatApplicable(vatAmount: string | undefined): boolean {
    if (!vatAmount) return false;
    const n = Number.parseFloat(vatAmount);
    return Number.isFinite(n) && n > 0;
}

export function isPositiveAmount(value: string | undefined): value is string {
    if (!value) return false;
    const n = Number.parseFloat(value);
    return Number.isFinite(n) && n > 0;
}

export type DrawOptions = {
    x?: number;
    size?: number;
    useFont?: PDFFont;
    color?: RGB;
};

/**
 * Small stateful cursor over a single PDF page — tracks the current `y`
 * position so callers can draw top-to-bottom without threading `y` through
 * every call. Scoped to one `render()` invocation; not shared across pages.
 */
export class PageCursor {
    y: number;
    private page: PDFPage;

    constructor(
        page: PDFPage,
        private readonly font: PDFFont,
        private readonly newPage: () => PDFPage
    ) {
        this.page = page;
        this.y = PAGE_HEIGHT - MARGIN;
    }

    text(text: string, options: DrawOptions = {}): void {
        const {
            x = MARGIN,
            size = 10,
            useFont = this.font,
            color = DARK,
        } = options;
        this.page.drawText(sanitizeForWinAnsi(text), {
            x,
            y: this.y,
            size,
            font: useFont,
            color,
        });
    }

    newLine(height = 16): void {
        this.y -= height;
    }

    /**
     * Draws a word-wrapped paragraph from the current position, advancing `y`
     * past every line drawn (including the last). Used for the longer legal /
     * attestation copy that can't fit on a single line.
     */
    paragraph(
        text: string,
        options: DrawOptions & { maxWidth?: number; lineHeight?: number } = {}
    ): void {
        const {
            x = MARGIN,
            size = 10,
            useFont = this.font,
            color = DARK,
            lineHeight = size + 3,
        } = options;
        const maxWidth = options.maxWidth ?? PAGE_WIDTH - MARGIN - x;
        const words = sanitizeForWinAnsi(text).split(/\s+/).filter(Boolean);
        let line = "";
        const flush = () => {
            if (!line) return;
            this.page.drawText(line, {
                x,
                y: this.y,
                size,
                font: useFont,
                color,
            });
            this.y -= lineHeight;
            line = "";
        };
        for (const word of words) {
            const candidate = line ? `${line} ${word}` : word;
            if (line && useFont.widthOfTextAtSize(candidate, size) > maxWidth) {
                flush();
                line = word;
            } else {
                line = candidate;
            }
        }
        flush();
    }

    /**
     * Draws an SVG path on the current page. `x`/`y` is where the path's SVG
     * origin lands (SVG y grows downward from there), `scale` maps the path's
     * viewBox units to points. Used to stamp the brand badge in page-fixed
     * coordinates, independent of the text cursor.
     */
    drawSvg(
        path: string,
        opts: { x: number; y: number; scale: number; color: RGB }
    ): void {
        this.page.drawSvgPath(path, {
            x: opts.x,
            y: opts.y,
            scale: opts.scale,
            color: opts.color,
        });
    }

    /**
     * Starts a fresh page if fewer than `minRemaining` points are left below
     * the bottom margin — used before drawing a table row so a row is never
     * split across pages (monthly-bill annex can be arbitrarily long).
     */
    ensureSpace(minRemaining: number): void {
        if (this.y - minRemaining < MARGIN) {
            this.page = this.newPage();
            this.y = PAGE_HEIGHT - MARGIN;
        }
    }
}
