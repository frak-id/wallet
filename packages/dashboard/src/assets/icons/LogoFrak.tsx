import type { SVGProps } from "react";

export const LogoFrak = (props: SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="36"
        height="36"
        fill="none"
        viewBox="0 0 36 36"
        {...props}
    >
        <title>Logo Frak</title>
        <path
            fill="url(#paint0_linear_8325_839)"
            d="M12.29 27.878L.46 23.875a.348.348 0 00-.46.33v7.302c0 .149.095.28.236.329l11.83 4.002a.348.348 0 00.46-.33v-7.301a.347.347 0 00-.236-.33zm12.306-14.003l-11.834 4.002a.348.348 0 00-.236.33v7.301c0 .238.234.406.46.33l11.832-4.003a.348.348 0 00.237-.33v-7.301a.348.348 0 00-.46-.33zM35.708.01l-19.81 6.378a.348.348 0 00-.242.331v7.482c0 .148.148.254.292.207l19.81-6.378a.348.348 0 00.242-.33V.218a.222.222 0 00-.292-.208z"
        />
        <defs>
            <linearGradient
                id="paint0_linear_8325_839"
                x1="1.677"
                x2="36.6"
                y1="29.793"
                y2="5.359"
                gradientUnits="userSpaceOnUse"
            >
                <stop offset="0.02" stopColor="#8B5EB3" />
                <stop offset="0.04" stopColor="#B155B3" />
                <stop offset="0.09" stopColor="#B13FB3" />
                <stop offset="0.14" stopColor="#B12FB3" />
                <stop offset="0.21" stopColor="#B125B3" />
                <stop offset="0.29" stopColor="#B123B3" />
                <stop offset="0.42" stopColor="#6E5CCA" />
                <stop offset="0.55" stopColor="#338EDE" />
                <stop offset="0.65" stopColor="#0FAEEB" />
                <stop offset="0.7" stopColor="#02BAF0" />
                <stop offset="0.9" stopColor="#02E6D5" />
            </linearGradient>
        </defs>
    </svg>
);
