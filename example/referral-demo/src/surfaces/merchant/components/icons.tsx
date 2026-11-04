import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Stroke({ size = 22, children, ...props }: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...props}
        >
            {children}
        </svg>
    );
}

export function BurgerIcon(props: IconProps) {
    return (
        <Stroke {...props}>
            <path d="M3 7h18M3 12h18M3 17h18" />
        </Stroke>
    );
}

export function SearchIcon(props: IconProps) {
    return (
        <Stroke {...props}>
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m15.5 15.5 5 5" />
        </Stroke>
    );
}

export function BagIcon(props: IconProps) {
    return (
        <Stroke {...props}>
            <path d="M5 8h14l-1 13H6L5 8Z" />
            <path d="M9 10V6a3 3 0 0 1 6 0v4" />
        </Stroke>
    );
}

export function ChevronDownIcon(props: IconProps) {
    return (
        <Stroke {...props}>
            <path d="m6 9 6 6 6-6" />
        </Stroke>
    );
}

export function ChevronRightIcon(props: IconProps) {
    return (
        <Stroke {...props}>
            <path d="m9 6 6 6-6 6" />
        </Stroke>
    );
}

export function PlusIcon(props: IconProps) {
    return (
        <Stroke {...props}>
            <path d="M12 5v14M5 12h14" />
        </Stroke>
    );
}

export function MinusIcon(props: IconProps) {
    return (
        <Stroke {...props}>
            <path d="M5 12h14" />
        </Stroke>
    );
}

export function CheckIcon(props: IconProps) {
    return (
        <Stroke {...props}>
            <path d="m5 12.5 4.5 4.5L19 7.5" />
        </Stroke>
    );
}

export function TruckIcon(props: IconProps) {
    return (
        <Stroke {...props}>
            <path d="M2.5 6.5h11v10h-11zM13.5 10h4l3 3.5v3h-7" />
            <circle cx="6.5" cy="17.5" r="1.8" />
            <circle cx="16.5" cy="17.5" r="1.8" />
        </Stroke>
    );
}

export function ReturnIcon(props: IconProps) {
    return (
        <Stroke {...props}>
            <path d="M4 9h11a5 5 0 0 1 0 10H8" />
            <path d="m8 5-4 4 4 4" />
        </Stroke>
    );
}

export function LeafIcon(props: IconProps) {
    return (
        <Stroke {...props}>
            <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Z" />
            <path d="M5 19 13 11" />
        </Stroke>
    );
}

export function LockIcon(props: IconProps) {
    return (
        <Stroke {...props}>
            <rect x="5" y="10.5" width="14" height="10" rx="2" />
            <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
        </Stroke>
    );
}

export function StarIcon({ size = 12, ...props }: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            aria-hidden="true"
            {...props}
        >
            <path
                fill="currentColor"
                d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8L12 2.8Z"
            />
        </svg>
    );
}

/** Drawn rather than typed: U+F8FF only renders on Apple devices. */
export function AppleLogo({ size = 18, ...props }: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            aria-hidden="true"
            {...props}
        >
            <path
                fill="currentColor"
                d="M12.15 6.9c-.95 0-2.42-1.08-3.96-1.04-2.04.03-3.91 1.18-4.96 3.01-2.12 3.68-.55 9.1 1.52 12.09 1.01 1.46 2.2 3.09 3.79 3.04 1.52-.07 2.09-.99 3.93-.99 1.84 0 2.35.99 3.96.95 1.64-.03 2.68-1.48 3.68-2.95 1.16-1.69 1.63-3.32 1.66-3.41-.04-.01-3.18-1.22-3.22-4.86-.03-3.04 2.48-4.49 2.6-4.56-1.43-2.09-3.63-2.32-4.39-2.38-2-.15-3.68 1.09-4.61 1.09Zm3.38-3.07c.84-1.01 1.4-2.43 1.25-3.83-1.21.05-2.67.8-3.53 1.82-.78.9-1.46 2.34-1.28 3.71 1.34.1 2.72-.69 3.56-1.7Z"
            />
        </svg>
    );
}

/** SDK post-purchase CTA glyph, copied from `PostPurchase.tsx`. */
export function CoinsIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            {...props}
        >
            <path
                d="M13.9 11.14C13.99 11.05 14.15 11.11 14.15 11.24V11.64C14.15 13.05 12.63 14.19 10.75 14.19C8.87 14.19 7.34 13.05 7.34 11.64V11.24C7.34 11.11 7.51 11.05 7.59 11.14C8.35 11.93 9.48 12.43 10.75 12.43C12.01 12.43 13.15 11.93 13.9 11.14ZM1.85 9.65C1.85 9.51 2.01 9.44 2.1 9.54C2.85 10.32 3.99 10.82 5.25 10.82C5.52 10.82 5.79 10.8 6.04 10.76C6.26 10.72 6.47 10.88 6.47 11.1V12.17C6.47 12.32 6.37 12.45 6.22 12.48C5.92 12.55 5.59 12.59 5.25 12.59C3.37 12.59 1.85 11.45 1.85 10.04V9.65ZM10.75 6.21C12.63 6.21 14.15 7.35 14.15 8.75C14.15 10.16 12.63 11.3 10.75 11.3C8.87 11.3 7.34 10.16 7.34 8.75C7.34 7.35 8.87 6.21 10.75 6.21ZM1.85 6.85C1.85 6.71 2.01 6.65 2.1 6.74C2.85 7.53 3.99 8.03 5.25 8.03C5.52 8.03 5.79 8 6.04 7.96C6.26 7.92 6.47 8.09 6.47 8.3V9.37C6.47 9.52 6.37 9.65 6.22 9.69C5.92 9.75 5.59 9.79 5.25 9.79C3.37 9.79 1.85 8.65 1.85 7.24V6.85ZM5.25 1.81C7.13 1.81 8.66 2.95 8.66 4.36C8.66 5.76 7.13 6.9 5.25 6.9C3.37 6.9 1.85 5.76 1.85 4.36C1.85 2.95 3.37 1.81 5.25 1.81Z"
                fill="currentColor"
            />
        </svg>
    );
}

/** SDK gift illustration (yellow accent + present), copied from `sdk/components/.../GiftIcon.tsx`. */
export function FrakGiftIllustration(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 100 100" fill="none" aria-hidden="true" {...props}>
            <circle cx="38" cy="28" r="23" fill="#FFF533" />
            <g
                stroke="#222222"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M50 38C30 10 12 30 50 38Z" />
                <path d="M50 38C70 10 88 30 50 38Z" />
                <rect x="10" y="38" width="80" height="16" rx="2" />
                <path d="M15 54V89C15 90.6 16.4 92 18 92H82C83.6 92 85 90.6 85 89V54" />
                <line x1="50" y1="54" x2="50" y2="92" />
            </g>
        </svg>
    );
}
