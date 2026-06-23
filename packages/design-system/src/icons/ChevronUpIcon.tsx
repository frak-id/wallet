import type { SVGProps } from "react";

export function ChevronUpIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            {...props}
        >
            <path
                d="M12.1928 10.2275C12.4011 10.0192 12.4011 9.68154 12.1928 9.47327L9.163 6.44399C8.61612 5.89719 7.72948 5.89739 7.18283 6.44442L4.15608 9.47334C3.94787 9.68169 3.94799 10.0194 4.15634 10.2276L4.43929 10.5103C4.64764 10.7185 4.98533 10.7184 5.19354 10.5101L8.17316 7.52831L11.1558 10.5104C11.3641 10.7187 11.7018 10.7187 11.91 10.5104L12.1928 10.2275Z"
                fill="currentColor"
            />
        </svg>
    );
}
