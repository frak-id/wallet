import { useSvgId } from "@/art";

export function LockGlyph({ className }: { className: string }) {
    return (
        <svg
            className={className}
            width="15"
            height="20"
            viewBox="0 0 15 20"
            fill="currentColor"
            aria-hidden="true"
        >
            <path
                d="M3.6 8.2V5.6a3.9 3.9 0 0 1 7.8 0v2.6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
            />
            <rect x="0.5" y="8" width="14" height="11.5" rx="2.6" />
        </svg>
    );
}

export function FlashlightGlyph() {
    return (
        <svg
            width="14"
            height="24"
            viewBox="0 0 14 24"
            fill="currentColor"
            aria-hidden="true"
        >
            <path d="M1.5 0h11c.6 0 1 .4 1 1v2.4H.5V1c0-.6.4-1 1-1Z" />
            <path d="M.5 4.8h13v.7c0 1-.4 1.9-1.1 2.6l-1.6 1.6c-.4.4-.6.9-.6 1.5V22c0 1.1-.9 2-2 2H5.8c-1.1 0-2-.9-2-2V11.2c0-.6-.2-1.1-.6-1.5L1.6 8.1C.9 7.4.5 6.5.5 5.5v-.7Z" />
            <circle cx="7" cy="14" r="1.4" fill="#000" fillOpacity="0.45" />
        </svg>
    );
}

export function CameraGlyph() {
    return (
        <svg
            width="24"
            height="19"
            viewBox="0 0 24 19"
            fill="currentColor"
            aria-hidden="true"
        >
            <path d="M8.6 0h6.8c.8 0 1.5.4 1.9 1.1L18.3 3H21c1.7 0 3 1.3 3 3v10c0 1.7-1.3 3-3 3H3c-1.7 0-3-1.3-3-3V6c0-1.7 1.3-3 3-3h2.7l1-1.9C7.1.4 7.8 0 8.6 0Zm3.4 5.2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />
        </svg>
    );
}

/** Light rippling on dark water, under the wallpaper's colour pools. */
export function Ripples({ className }: { className: string }) {
    const id = useSvgId();
    const rows = [
        { y: 40, amp: 6, opacity: 0.18 },
        { y: 90, amp: 9, opacity: 0.22 },
        { y: 150, amp: 12, opacity: 0.28 },
        { y: 220, amp: 16, opacity: 0.32 },
        { y: 300, amp: 20, opacity: 0.36 },
        { y: 390, amp: 24, opacity: 0.4 },
    ];
    return (
        <svg
            className={className}
            viewBox="0 0 400 440"
            preserveAspectRatio="none"
            aria-hidden="true"
        >
            <defs>
                <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#fff" stopOpacity="0" />
                    <stop offset="0.5" stopColor="#ffe3c8" stopOpacity="1" />
                    <stop offset="1" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
            </defs>
            {rows.map((row) => (
                <path
                    key={row.y}
                    d={`M-20 ${row.y} C 80 ${row.y - row.amp}, 140 ${row.y + row.amp}, 200 ${row.y} S 330 ${row.y - row.amp}, 420 ${row.y}`}
                    fill="none"
                    stroke={`url(#${id}-fade)`}
                    strokeOpacity={row.opacity}
                    strokeWidth={1.2 + row.amp / 12}
                    strokeLinecap="round"
                />
            ))}
        </svg>
    );
}

/** iOS Mail's app icon, filling its rounded slot. */
export function MailAppIcon() {
    const id = useSvgId();
    return (
        <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true">
            <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#1e9bff" />
                    <stop offset="1" stopColor="#1066f0" />
                </linearGradient>
            </defs>
            <rect width="38" height="38" fill={`url(#${id})`} />
            <rect x="8" y="12" width="22" height="15" rx="2.2" fill="#fff" />
            <path
                d="M8.8 13.2 19 20.6l10.2-7.4"
                fill="none"
                stroke="#1677f5"
                strokeWidth="1.6"
                strokeLinejoin="round"
            />
        </svg>
    );
}
