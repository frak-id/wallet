import type { SVGProps } from "react";

export const Share = (props: SVGProps<SVGSVGElement>) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="27"
            fill="none"
            viewBox="0 0 22 27"
            {...props}
        >
            <title>Share</title>
            <g fill="#fff">
                <path
                    fillRule="evenodd"
                    d="M2.81 9.167a.62.62 0 0 0-.619.619v14.857a.62.62 0 0 0 .62.619h17.333a.62.62 0 0 0 .619-.62V9.787a.62.62 0 0 0-.62-.62h-4.952a.62.62 0 0 1 0-1.237h4.953c1.025 0 1.857.831 1.857 1.857v14.857a1.857 1.857 0 0 1-1.857 1.857H2.81a1.857 1.857 0 0 1-1.857-1.857V9.786c0-1.026.832-1.857 1.857-1.857h4.953a.62.62 0 0 1 0 1.238z"
                    clipRule="evenodd"
                />
                <path d="M11.915.681a.62.62 0 0 0-.876 0L7.325 4.396a.619.619 0 1 0 .875.875l2.658-2.657v13.362a.62.62 0 0 0 1.238 0V2.614l2.657 2.657a.62.62 0 0 0 .876-.875z" />
            </g>
        </svg>
    );
};
