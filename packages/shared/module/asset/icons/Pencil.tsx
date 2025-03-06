import type { SVGProps } from "react";

export const Pencil = (props: SVGProps<SVGSVGElement>) => {
    const { color, ...rest } = props;
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="17"
            viewBox="0 0 18 17"
            fill="none"
            {...rest}
        >
            <title>Edit</title>
            <g clipPath="url(#clip0_8318_453)">
                <path
                    fill={color ?? "#fff"}
                    d="M5.54829 15.9814L0.5 17L1.51858 11.951L5.54829 15.9814ZM6.54988 14.9798L14.503 7.02879L10.4726 2.99696L2.52017 10.9494L6.54988 14.9798ZM13.4689 0L11.4742 1.99537L15.5053 6.0265L17.5 4.02971L13.4689 0Z"
                />
            </g>
            <defs>
                <clipPath id="clip0_8318_453">
                    <rect
                        width="17"
                        height="17"
                        fill={color ?? "#fff"}
                        transform="translate(0.5)"
                    />
                </clipPath>
            </defs>
        </svg>
    );
};
