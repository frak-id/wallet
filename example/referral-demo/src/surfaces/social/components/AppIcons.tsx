import { type ReactNode, useId } from "react";

type IconProps = { size?: number };

function Squircle({ size, children }: { size: number; children: ReactNode }) {
    return (
        <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden="true">
            {children}
        </svg>
    );
}

const SQUIRCLE = "M30 0c22 0 30 8 30 30s-8 30-30 30S0 52 0 30 8 0 30 0Z";

export function AirDropAppIcon({ size = 60 }: IconProps) {
    const id = useId();
    return (
        <Squircle size={size}>
            <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#5ac8fa" />
                    <stop offset="1" stopColor="#0a7aff" />
                </linearGradient>
            </defs>
            <path d={SQUIRCLE} fill={`url(#${id})`} />
            <g
                fill="none"
                stroke="#fff"
                strokeWidth="2.6"
                strokeLinecap="round"
            >
                <path d="M21.5 38.5a12 12 0 1 1 17 0" />
                <path d="M25.3 34.7a6.6 6.6 0 1 1 9.4 0" />
            </g>
            <path d="M30 33.2 35 43H25Z" fill="#fff" />
        </Squircle>
    );
}

export function MessagesAppIcon({ size = 60 }: IconProps) {
    const id = useId();
    return (
        <Squircle size={size}>
            <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#67ff81" />
                    <stop offset="1" stopColor="#01b41f" />
                </linearGradient>
            </defs>
            <path d={SQUIRCLE} fill={`url(#${id})`} />
            <path
                fill="#fff"
                d="M30 13.5c-10.5 0-19 6.9-19 15.4 0 4.9 2.8 9.2 7.2 12-.4 2.3-1.6 4.4-3.5 6 3.5.2 6.8-.9 9.3-3 1.9.4 3.9.6 6 .6 10.5 0 19-6.9 19-15.5S40.5 13.5 30 13.5Z"
            />
        </Squircle>
    );
}

export function MailAppIcon({ size = 60 }: IconProps) {
    const id = useId();
    return (
        <Squircle size={size}>
            <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#1ac8fc" />
                    <stop offset="1" stopColor="#1e6ef4" />
                </linearGradient>
            </defs>
            <path d={SQUIRCLE} fill={`url(#${id})`} />
            <rect x="12" y="18" width="36" height="25" rx="3.5" fill="#fff" />
            <path
                d="m13 19.5 15.2 12.2c1 .8 2.6.8 3.6 0L47 19.5"
                fill="none"
                stroke="#3d8ff2"
                strokeWidth="1.6"
                strokeLinejoin="round"
            />
        </Squircle>
    );
}

export function WhatsAppAppIcon({ size = 60 }: IconProps) {
    return (
        <Squircle size={size}>
            <path d={SQUIRCLE} fill="#25d366" />
            <path
                fill="#fff"
                d="M30 12.5a17.4 17.4 0 0 0-15 26.3L12.6 47.5l9-2.4A17.4 17.4 0 1 0 30 12.5Zm0 3a14.4 14.4 0 1 1-7.3 26.8l-.5-.3-5.3 1.4 1.4-5.2-.3-.5A14.4 14.4 0 0 1 30 15.5Z"
            />
            <path
                fill="#fff"
                d="M23.6 21.6c-.4-.9-.8-.9-1.2-.9h-1c-.4 0-.9.1-1.4.7-.5.5-1.8 1.8-1.8 4.3s1.9 5 2.1 5.3c.3.4 3.6 5.8 8.9 7.9 4.4 1.7 5.3 1.4 6.3 1.3 1-.1 3.1-1.3 3.5-2.5.4-1.2.4-2.3.3-2.5-.1-.2-.5-.4-1-.6l-3.5-1.7c-.5-.2-.8-.3-1.2.2l-1.6 2c-.3.4-.6.4-1.1.1-.5-.3-2.2-.8-4.2-2.6-1.6-1.4-2.6-3.1-2.9-3.6-.3-.5 0-.8.2-1l.8-.9.5-.9c.2-.4.1-.7 0-.9l-1.6-3.9Z"
            />
        </Squircle>
    );
}

export function InstagramAppIcon({ size = 60 }: IconProps) {
    const id = useId();
    return (
        <Squircle size={size}>
            <defs>
                <radialGradient id={id} cx="0.3" cy="1.07" r="1.1">
                    <stop offset="0" stopColor="#fdf497" />
                    <stop offset="0.08" stopColor="#fdf497" />
                    <stop offset="0.45" stopColor="#fd5949" />
                    <stop offset="0.6" stopColor="#d6249f" />
                    <stop offset="0.9" stopColor="#285aeb" />
                </radialGradient>
            </defs>
            <path d={SQUIRCLE} fill={`url(#${id})`} />
            <rect
                x="15"
                y="15"
                width="30"
                height="30"
                rx="9"
                fill="none"
                stroke="#fff"
                strokeWidth="3.2"
            />
            <circle
                cx="30"
                cy="30"
                r="7.2"
                fill="none"
                stroke="#fff"
                strokeWidth="3.2"
            />
            <circle cx="39.2" cy="20.8" r="2" fill="#fff" />
        </Squircle>
    );
}

export function NotesAppIcon({ size = 60 }: IconProps) {
    const id = useId();
    return (
        <Squircle size={size}>
            <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#ffe066" />
                    <stop offset="1" stopColor="#ffcb2e" />
                </linearGradient>
                <clipPath id={`${id}-clip`}>
                    <path d={SQUIRCLE} />
                </clipPath>
            </defs>
            <g clipPath={`url(#${id}-clip)`}>
                <rect width="60" height="60" fill="#fdfdfb" />
                <rect width="60" height="17" fill={`url(#${id})`} />
                <g stroke="#d9d6cf" strokeWidth="1">
                    <path d="M0 29.5h60M0 39.5h60M0 49.5h60" />
                </g>
                <g fill="#c8c4bb">
                    <circle cx="8" cy="22" r="1" />
                    <circle cx="14" cy="22" r="1" />
                    <circle cx="20" cy="22" r="1" />
                    <circle cx="26" cy="22" r="1" />
                    <circle cx="32" cy="22" r="1" />
                    <circle cx="38" cy="22" r="1" />
                    <circle cx="44" cy="22" r="1" />
                    <circle cx="50" cy="22" r="1" />
                </g>
            </g>
        </Squircle>
    );
}
