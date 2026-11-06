const line = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
} as const;

const GLYPHS = {
    copy: (
        <>
            <rect {...line} x="8" y="8" width="11" height="12" rx="2.2" />
            <path
                {...line}
                d="M16 8V6.2A2.2 2.2 0 0 0 13.8 4H7.2A2.2 2.2 0 0 0 5 6.2v8.6A2.2 2.2 0 0 0 7.2 17H8"
            />
        </>
    ),
    glasses: (
        <>
            <circle {...line} cx="6.5" cy="14" r="3.6" />
            <circle {...line} cx="17.5" cy="14" r="3.6" />
            <path
                {...line}
                d="M10.1 13.4c1.2-.9 2.6-.9 3.8 0M2.9 13.2 4.6 7M21.1 13.2 19.4 7"
            />
        </>
    ),
    book: (
        <>
            <path
                {...line}
                d="M12 6.5c-2-1.5-4.7-2-8-1.8v13c3.3-.2 6 .3 8 1.8 2-1.5 4.7-2 8-1.8v-13c-3.3-.2-6 .3-8 1.8Z"
            />
            <path {...line} d="M12 6.5v13" />
        </>
    ),
    star: (
        <path
            {...line}
            d="m12 3.8 2.5 5.1 5.6.8-4 4 1 5.6-5.1-2.7-5 2.7 1-5.6-4.1-4 5.6-.8Z"
        />
    ),
    find: (
        <>
            <rect {...line} x="4" y="3.5" width="12" height="16" rx="2" />
            <circle {...line} cx="14.5" cy="14.5" r="3.6" />
            <path {...line} d="m17.2 17.2 3 3M7 7.5h6M7 10.5h3" />
        </>
    ),
};

export type ActionGlyphName = keyof typeof GLYPHS;

/** SF Symbols-like glyphs for the share sheet's action rows. */
export function ActionGlyph({ name }: { name: ActionGlyphName }) {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            {GLYPHS[name]}
        </svg>
    );
}
