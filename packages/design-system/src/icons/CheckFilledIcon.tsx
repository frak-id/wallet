import type { SVGProps } from "react";

/** Filled circle with a check, drawn at a 12px viewBox (uses currentColor). */
export function CheckFilledIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            {...props}
        >
            <path
                d="M6 0.5C9.03757 0.5 11.5 2.96243 11.5 6C11.5 9.03757 9.03757 11.5 6 11.5C2.96243 11.5 0.5 9.03757 0.5 6C0.5 2.96243 2.96243 0.5 6 0.5ZM8.7207 4.03516C8.53408 3.84914 8.23149 3.84905 8.04492 4.03516L5.12891 6.9502L3.9541 5.77637C3.76736 5.59006 3.46394 5.58983 3.27734 5.77637C3.09128 5.96289 3.09148 6.2655 3.27734 6.45215L4.79004 7.96484C4.97666 8.15146 5.28004 8.15124 5.4668 7.96484L8.7207 4.71191C8.90737 4.52518 8.90741 4.22186 8.7207 4.03516Z"
                fill="currentColor"
            />
        </svg>
    );
}
