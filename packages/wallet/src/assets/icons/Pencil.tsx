import type { SVGProps } from "react";

export const Pencil = (props: SVGProps<SVGSVGElement>) => {
    const { color, ...rest } = props;
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="25"
            fill="none"
            viewBox="0 0 24 25"
            {...rest}
        >
            <title>Edit</title>
            <g clipPath="url(#clip0_8318_453)">
                <path
                    fill={color ?? "#fff"}
                    d="M7.127 23.49L0 24.93 1.438 17.8l5.689 5.69zm1.414-1.413L19.769 10.85l-5.69-5.692L2.852 16.387l5.689 5.69zM18.309.927l-2.816 2.817 5.691 5.691L24 6.617 18.309.928z"
                />
            </g>
            <defs>
                <clipPath id="clip0_8318_453">
                    <path
                        fill={color ?? "#fff"}
                        d="M0 0H24V24H0z"
                        transform="translate(0 .928)"
                    />
                </clipPath>
            </defs>
        </svg>
    );
};
