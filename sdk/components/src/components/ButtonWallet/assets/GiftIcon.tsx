import type { JSX } from "preact";

export function GiftIcon(props: JSX.SVGAttributes<SVGSVGElement>) {
    return (
        <svg
            fill="none"
            height="1em"
            viewBox="0 0 28 28"
            width="1em"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Gift icon</title>
            <path
                d="m23.14 14v11.43h-18.29v-11.43m9.14 11.43v-17.14m0 0h-5.14c-0.76 0-1.48-0.3-2.02-0.84s-0.84-1.26-0.84-2.020.3-1.480.84-2.02 1.26-0.84 2.02-0.84c4 0 5.14 5.71 5.14 5.71zm0 0h5.14c0.76 0 1.48-0.3 2.02-0.84s0.84-1.260.84-2.02-0.3-1.48-0.84-2.02-1.26-0.84-2.02-0.84c-4 0-5.14 5.71-5.14 5.71zm-11.43 0h22.86v5.71h-22.86z"
                stroke="#fff"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
    );
}
