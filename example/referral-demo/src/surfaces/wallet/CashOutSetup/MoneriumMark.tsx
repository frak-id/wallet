const MONERIUM_NAVY = "#14213d";

/** Monerium's app mark, drawn for the hand-off: not a Frak asset, so its own colour. */
export function MoneriumMark({ size = 40 }: { size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 40 40"
            role="img"
            aria-label="Monerium"
        >
            <rect width="40" height="40" rx="12" fill={MONERIUM_NAVY} />
            <path
                d="M12.5 27V17.5a3.75 3.75 0 0 1 7.5 0V27m0-9.5a3.75 3.75 0 0 1 7.5 0V27"
                fill="none"
                stroke="#fff"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
