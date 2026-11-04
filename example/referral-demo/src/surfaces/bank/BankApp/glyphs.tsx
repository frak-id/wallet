import type { ReactNode } from "react";

function Glyph({
    size = 24,
    children,
}: {
    size?: number;
    children: ReactNode;
}) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {children}
        </svg>
    );
}

export const glyphs = {
    search: (
        <Glyph size={20}>
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
        </Glyph>
    ),
    bell: (
        <Glyph size={20}>
            <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5Z" />
            <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
        </Glyph>
    ),
    transfer: (
        <Glyph size={22}>
            <path d="M5 8.5h13M14.5 5l3.5 3.5-3.5 3.5" />
            <path d="M19 15.5H6M9.5 12 6 15.5 9.5 19" />
        </Glyph>
    ),
    topUp: (
        <Glyph size={22}>
            <path d="M12 5v14M5 12h14" />
        </Glyph>
    ),
    details: (
        <Glyph size={22}>
            <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
            <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
        </Glyph>
    ),
    more: (
        <Glyph size={22}>
            <circle cx="6" cy="12" r="0.6" strokeWidth="2.6" />
            <circle cx="12" cy="12" r="0.6" strokeWidth="2.6" />
            <circle cx="18" cy="12" r="0.6" strokeWidth="2.6" />
        </Glyph>
    ),
    incoming: (
        <Glyph size={20}>
            <path d="M17 7 7 17M7 9.5V17h7.5" />
        </Glyph>
    ),
    home: (
        <Glyph>
            <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19Z" />
        </Glyph>
    ),
    cards: (
        <Glyph>
            <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
            <path d="M3 10h18M7 14.5h3" />
        </Glyph>
    ),
    payments: (
        <Glyph>
            <path d="M5 8.5h13M14.5 5l3.5 3.5-3.5 3.5" />
            <path d="M19 15.5H6M9.5 12 6 15.5 9.5 19" />
        </Glyph>
    ),
    budget: (
        <Glyph>
            <path d="M12 3.5v8.5h8.5" />
            <path d="M20.3 13.6A8.5 8.5 0 1 1 10.4 3.7" />
        </Glyph>
    ),
    profile: (
        <Glyph>
            <circle cx="12" cy="8.5" r="4" />
            <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
        </Glyph>
    ),
};
