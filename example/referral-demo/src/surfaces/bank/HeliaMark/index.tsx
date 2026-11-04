import { useSvgId } from "@/art";
import { bank } from "@/data/bank";
import { helia } from "../palette";
import * as styles from "./heliaMark.css";

/** Hélia's sunrise: a half sun on the horizon and its reflection; `tile` sets it on the app-icon ink. */
export function HeliaMark({
    size,
    tile = false,
}: {
    size: number;
    tile?: boolean;
}) {
    const id = useSvgId();
    return (
        <svg
            className={styles.mark}
            width={size}
            height={size}
            viewBox="0 0 38 38"
            role="img"
            aria-label={bank.name}
        >
            <defs>
                <linearGradient id={`${id}-sun`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={helia.sun} />
                    <stop offset="1" stopColor={helia.coral} />
                </linearGradient>
                <radialGradient id={`${id}-glow`} cx="0.5" cy="0.62" r="0.6">
                    <stop offset="0" stopColor={helia.inkSoft} />
                    <stop offset="1" stopColor={helia.ink} />
                </radialGradient>
            </defs>
            {tile && <rect width="38" height="38" fill={`url(#${id}-glow)`} />}
            <path d="M9 22.5a10 10 0 0 1 20 0Z" fill={`url(#${id}-sun)`} />
            <rect
                x="7"
                y="24.6"
                width="24"
                height="2.2"
                rx="1.1"
                fill={helia.coral}
            />
            <rect
                x="12"
                y="28.6"
                width="14"
                height="2.2"
                rx="1.1"
                fill={helia.coral}
                fillOpacity="0.55"
            />
        </svg>
    );
}
