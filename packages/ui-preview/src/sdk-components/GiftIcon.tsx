type GiftIconProps = {
    className?: string;
    width?: number;
    height?: number;
};

/**
 * Gift icon used in Banner and PostPurchase previews (matches SDK component icon)
 */
export function GiftIcon({
    className,
    width = 40,
    height = 40,
}: GiftIconProps) {
    return (
        <svg
            className={className}
            width={width}
            height={height}
            viewBox="0 0 100 100"
            fill="none"
            aria-hidden="true"
        >
            <circle cx="38" cy="28" r="23" fill="#FFF533" />
            <path
                d="M50 38C30 10 12 30 50 38Z"
                stroke="#222222"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M50 38C70 10 88 30 50 38Z"
                stroke="#222222"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <rect
                x="10"
                y="38"
                width="80"
                height="16"
                rx="2"
                stroke="#222222"
                strokeWidth="4"
            />
            <path
                d="M15 54V89C15 90.6 16.4 92 18 92H82C83.6 92 85 90.6 85 89V54"
                stroke="#222222"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <line
                x1="50"
                y1="54"
                x2="50"
                y2="92"
                stroke="#222222"
                strokeWidth="4"
                strokeLinecap="round"
            />
        </svg>
    );
}
