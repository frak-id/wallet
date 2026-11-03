import type { ReactNode } from "react";

const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
} as const;

const ROUNDED_SQUARE =
    "M2 12v3.45c0 2.85.7 4 1.6 4.95.94.9 2.1 1.6 4.95 1.6h6.9c2.85 0 4-.7 4.95-1.6.9-.94 1.6-2.1 1.6-4.95v-6.9c0-2.85-.7-4-1.6-4.95C19.45 2.7 18.3 2 15.45 2h-6.9c-2.85 0-4 .7-4.95 1.6C2.7 4.55 2 5.7 2 8.55Z";

const GLYPHS = {
    heart: (
        <path
            {...stroke}
            d="M12 20.4s-7.6-4.5-9.3-9.3C1.5 7.5 3.8 4 7.4 4c2 0 3.6 1.1 4.6 2.8C13 5.1 14.6 4 16.6 4c3.6 0 5.9 3.5 4.7 7.1-1.7 4.8-9.3 9.3-9.3 9.3Z"
        />
    ),
    heartFilled: (
        <path
            fill="currentColor"
            d="M12 20.4s-7.6-4.5-9.3-9.3C1.5 7.5 3.8 4 7.4 4c2 0 3.6 1.1 4.6 2.8C13 5.1 14.6 4 16.6 4c3.6 0 5.9 3.5 4.7 7.1-1.7 4.8-9.3 9.3-9.3 9.3Z"
        />
    ),
    comment: <path {...stroke} d="M20.66 17A10 10 0 1 0 17.07 20.62L22 22Z" />,
    send: (
        <>
            <path {...stroke} d="M22 3 9.22 10.08" />
            <path {...stroke} d="M11.7 20.33 22 3H2l7.22 7.08 2.48 10.25Z" />
        </>
    ),
    bookmark: <path {...stroke} d="M20 21l-8-7.56L4 21V3h16v18Z" />,
    home: (
        <path
            fill="currentColor"
            d="M22 23h-6a1 1 0 0 1-1-1v-5.45a3 3 0 1 0-6 0V22a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V11.54a1 1 0 0 1 .31-.72l10-9.54a1 1 0 0 1 1.38 0l10 9.54a1 1 0 0 1 .31.72V22a1 1 0 0 1-1 1Z"
        />
    ),
    search: (
        <>
            <circle {...stroke} cx="10.5" cy="10.5" r="8.5" />
            <path {...stroke} d="M16.51 16.51 22 22" />
        </>
    ),
    newPost: (
        <>
            <path {...stroke} d={ROUNDED_SQUARE} />
            <path {...stroke} d="M6.55 12h10.9M12 6.55v10.9" />
        </>
    ),
    reels: (
        <>
            <path {...stroke} d={ROUNDED_SQUARE} />
            <path {...stroke} d="M2.05 7h19.9M13.5 2l2.86 5M7.2 2.1 10 7" />
            <path
                fill="currentColor"
                d="M9.76 17.66a.9.9 0 0 1-.45-.79v-5.24a.9.9 0 0 1 1.36-.79l4.55 2.62a.9.9 0 0 1 0 1.58l-4.55 2.62a.9.9 0 0 1-.91 0Z"
            />
        </>
    ),
    messenger: (
        <>
            <path
                {...stroke}
                strokeWidth={1.75}
                d="M12 2a9.7 9.7 0 1 1 0 19.4c-1 0-1.97-.13-2.9-.38a.8.8 0 0 0-.53.04l-1.98.87a.8.8 0 0 1-1.12-.7l-.06-1.79a.8.8 0 0 0-.27-.57A9.5 9.5 0 0 1 2 11.7 9.65 9.65 0 0 1 12 2Z"
            />
            <path
                fill="currentColor"
                d="M17.79 10.13a.66.66 0 0 0-.96-.87l-2.56 2.05a.63.63 0 0 1-.76 0L11.06 9.47a1.58 1.58 0 0 0-2.28.42l-2.57 3.98a.66.66 0 0 0 .96.88l2.56-2.05a.63.63 0 0 1 .76 0l2.45 1.84a1.58 1.58 0 0 0 2.28-.42Z"
            />
        </>
    ),
    close: <path {...stroke} strokeWidth={2.2} d="M5 5l14 14M19 5 5 19" />,
    more: (
        <>
            <circle cx="5" cy="12" r="1.6" fill="currentColor" />
            <circle cx="12" cy="12" r="1.6" fill="currentColor" />
            <circle cx="19" cy="12" r="1.6" fill="currentColor" />
        </>
    ),
    chevronDown: <path {...stroke} d="m7 10 5 5 5-5" />,
    chevronRight: <path {...stroke} d="m9 5 7 7-7 7" />,
    link: (
        <>
            <path
                {...stroke}
                strokeWidth={2.4}
                d="M10 13.5a4.2 4.2 0 0 0 6 .2l3-3a4.2 4.2 0 0 0-6-6l-1.2 1.2"
            />
            <path
                {...stroke}
                strokeWidth={2.4}
                d="M14 10.5a4.2 4.2 0 0 0-6-.2l-3 3a4.2 4.2 0 0 0 6 6l1.2-1.2"
            />
        </>
    ),
    sticker: (
        <>
            <path
                {...stroke}
                d="M21 12.5V7a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h5.5L21 12.5Z"
            />
            <path {...stroke} d="M12.5 21v-4.5a4 4 0 0 1 4-4H21" />
            <path {...stroke} d="M8 14.5a4.5 4.5 0 0 0 3 1.4" />
            <circle cx="8.6" cy="9.2" r="1.2" fill="currentColor" />
            <circle cx="14.4" cy="9.2" r="1.2" fill="currentColor" />
        </>
    ),
    music: (
        <>
            <path {...stroke} d="M9 18V5l11-2v13" />
            <circle {...stroke} cx="6" cy="18" r="3" />
            <circle {...stroke} cx="17" cy="16" r="3" />
        </>
    ),
    sparkles: (
        <>
            <path
                {...stroke}
                d="M10 3.5 11.8 8.2 16.5 10 11.8 11.8 10 16.5 8.2 11.8 3.5 10 8.2 8.2Z"
            />
            <path
                {...stroke}
                strokeWidth={1.7}
                d="M18 14.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9Z"
            />
        </>
    ),
    text: (
        <text
            x="12"
            y="17"
            textAnchor="middle"
            fontSize="15"
            fontWeight="700"
            fill="currentColor"
            fontFamily="-apple-system, Helvetica, Arial, sans-serif"
        >
            Aa
        </text>
    ),
    star: (
        <path
            fill="currentColor"
            d="m12 3.2 2.6 5.5 6 .7-4.4 4.1 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.4l6-.7Z"
        />
    ),
    arrowRight: (
        <path {...stroke} strokeWidth={2.4} d="M5 12h14m-6-6 6 6-6 6" />
    ),
    plus: <path {...stroke} strokeWidth={2.6} d="M12 6v12M6 12h12" />,
    grid: (
        <>
            <rect {...stroke} x="3" y="3" width="18" height="18" rx="4" />
            <path {...stroke} d="M3 9.5h18M3 14.5h18M9.5 3v18M14.5 3v18" />
        </>
    ),
} satisfies Record<string, ReactNode>;

export type IgIconName = keyof typeof GLYPHS;

/** Instagram's line glyphs on a 24 grid; colour follows `currentColor`. */
export function IgIcon({
    name,
    size = 24,
    className,
}: {
    name: IgIconName;
    size?: number;
    className?: string;
}) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            className={className}
            aria-hidden="true"
        >
            {GLYPHS[name]}
        </svg>
    );
}
