import type { SVGProps } from "react";

export function ClockHandsIcon(props: SVGProps<SVGSVGElement>) {
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
                d="M5.94032 1.22388C5.61661 1.22388 5.35419 1.48629 5.35419 1.81V5.37558H3.16425C2.84054 5.37558 2.57812 5.63799 2.57812 5.9617V6.25476C2.57812 6.57847 2.84054 6.84088 3.16425 6.84088L5.69044 6.84093C6.31177 6.84094 6.81546 6.33726 6.81546 5.71593V1.81C6.81546 1.48629 6.55305 1.22388 6.22934 1.22388H5.94032Z"
                fill="currentColor"
            />
        </svg>
    );
}
