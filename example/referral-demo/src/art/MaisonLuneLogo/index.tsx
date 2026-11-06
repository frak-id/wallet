import { clsx } from "clsx";
import { merchant } from "@/data/merchant";
import { fonts } from "@/shell/device.css";
import { block } from "../components/block.css";
import { crescentPath } from "../components/svg";
import type { MaisonLuneLogoProps } from "../contracts";

export function MaisonLuneLogo({
    tone = "ink",
    variant = "wordmark",
    className,
}: MaisonLuneLogoProps) {
    const color =
        tone === "ink" ? merchant.palette.ink : merchant.palette.paper;
    const ground =
        tone === "ink" ? merchant.palette.paper : merchant.palette.ink;

    if (variant === "monogram") {
        return (
            <svg
                className={clsx(block, className)}
                width="100%"
                height="100%"
                viewBox="0 0 100 100"
                role="img"
                aria-label={merchant.name}
            >
                <circle cx="50" cy="50" r="50" fill={color} />
                <circle
                    cx="50"
                    cy="50"
                    r="43"
                    fill="none"
                    stroke={ground}
                    strokeOpacity="0.35"
                    strokeWidth="0.8"
                />
                <path
                    d={crescentPath(50, 50, 22)}
                    fill={ground}
                    transform="rotate(-28 50 50)"
                />
                <circle cx="63" cy="35" r="1.6" fill={ground} />
            </svg>
        );
    }

    return (
        <svg
            className={clsx(block, className)}
            width="100%"
            height="100%"
            viewBox="0 0 182 24"
            role="img"
            aria-label={merchant.name}
        >
            <path
                d={crescentPath(10, 12, 8.5)}
                fill={color}
                transform="rotate(-28 10 12)"
            />
            <text
                x="28"
                y="18.2"
                fontFamily={fonts.serif}
                fontSize="17"
                fill={color}
                textLength="154"
                lengthAdjust="spacing"
            >
                MAISON LUNE
            </text>
        </svg>
    );
}
