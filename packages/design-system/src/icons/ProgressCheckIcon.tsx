import type { SVGProps } from "react";

/**
 * Progress-with-check icon
 *
 * Three filled paths: a faint full ring (opacity 0.2), a bold arc covering
 * the left ~120° of the ring, and a centered check. Uses `currentColor`
 * so the parent's `color` drives all three.
 */
export function ProgressCheckIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            {...props}
        >
            <path
                opacity="0.2"
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 22.08C17.567 22.08 22.08 17.567 22.08 12C22.08 6.43297 17.567 1.92 12 1.92C6.43297 1.92 1.92 6.43297 1.92 12C1.92 17.567 6.43297 22.08 12 22.08ZM12 24C18.6274 24 24 18.6274 24 12C24 5.37258 18.6274 0 12 0C5.37258 0 0 5.37258 0 12C0 18.6274 5.37258 24 12 24Z"
                fill="currentColor"
            />
            <path
                d="M2.06293 16.9464C1.62026 17.1573 1.0848 16.9958 0.89018 16.5457C0.22781 15.0141 0 13.1526 0 11.4336C0 5.41224 4.88517 0.478026 11.0852 0.0327265C11.5891 -0.00346255 12 0.409519 12 0.914687C12 1.41986 11.5892 1.82523 11.0859 1.86834C5.94721 2.30846 1.92 6.42292 1.92 11.4336C1.92 12.8019 2.07249 14.3038 2.55235 15.5651C2.75032 16.0854 2.56554 16.707 2.06293 16.9464Z"
                fill="currentColor"
            />
            <path
                d="M15.9941 8.90756C16.3244 8.58638 16.8618 8.58638 17.192 8.90756C17.5197 9.2262 17.5197 9.74085 17.192 10.0595L11.9153 15.1909C11.585 15.5121 11.0477 15.5121 10.7174 15.1909L8.07901 12.6252C7.75133 12.3066 7.75133 11.7919 8.07901 11.4733C8.40928 11.1521 8.94664 11.1521 9.27692 11.4733L11.3163 13.4565L15.9941 8.90756Z"
                fill="currentColor"
            />
        </svg>
    );
}
