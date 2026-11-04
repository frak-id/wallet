import { useT } from "@/i18n";
import { shellMessages } from "../messages";
import * as styles from "./rotateHint.css";

/** The demo is a portrait phone UI: ask for portrait on landscape phones (CSS-only). */
export function RotateHint() {
    const t = useT(shellMessages);
    return (
        <div className={styles.overlay} aria-hidden="true">
            <svg
                width="56"
                height="56"
                viewBox="0 0 56 56"
                fill="none"
                aria-hidden="true"
            >
                <rect
                    x="17"
                    y="6"
                    width="22"
                    height="40"
                    rx="5"
                    stroke="currentColor"
                    strokeWidth="2.5"
                />
                <path
                    d="M46 34a18 18 0 0 1-12 16M42 52l-8-2 3-7"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
            <p className={styles.text}>{t("rotate")}</p>
        </div>
    );
}
