import type { SVGProps } from "react";

export const Timer = (props: SVGProps<SVGSVGElement>) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="17"
            height="17"
            fill="none"
            viewBox="0 0 17 17"
            {...props}
        >
            <title>Timer</title>
            <path
                fill="#7C7B8C"
                d="M8.5 0A8.5 8.5 0 000 8.5 8.5 8.5 0 008.5 17 8.5 8.5 0 0017 8.5 8.5 8.5 0 008.5 0zM5.136 4.673l4.29 2.901A1.328 1.328 0 017.904 9.75a1.36 1.36 0 01-.327-.327l-2.901-4.29a.332.332 0 01.463-.463l-.003.003zM8.5 15.693c-3.964 0-7.192-3.227-7.192-7.193a7.131 7.131 0 012.2-5.178.578.578 0 11.803.832A5.987 5.987 0 002.464 8.5 6.043 6.043 0 008.5 14.536 6.043 6.043 0 0014.536 8.5c0-3.133-2.4-5.716-5.458-6.007V4.74a.578.578 0 01-1.157 0V1.886c0-.32.26-.578.579-.578 3.966 0 7.192 3.228 7.192 7.192s-3.226 7.193-7.192 7.193z"
            />
        </svg>
    );
};
