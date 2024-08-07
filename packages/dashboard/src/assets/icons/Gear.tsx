import type { SVGProps } from "react";

export const Gear = (props: SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="currentColor"
        viewBox="0 0 24 24"
        {...props}
    >
        <title>Settings</title>
        <path
            fill="inherit"
            fillRule="evenodd"
            d="M16 12a4 4 0 11-8 0 4 4 0 018 0zm-2 0a2 2 0 11-4 0 2 2 0 014 0z"
            clipRule="evenodd"
        />
        <path
            fill="currentColor"
            fillRule="evenodd"
            d="M3.51 13.414l.656-.394a7.972 7.972 0 010-2.04l-.654-.393a2 2 0 01-.685-2.745L4.02 5.857a2 2 0 012.745-.684l.654.393a7.883 7.883 0 011.419-.804V4a2 2 0 012-2h2.315a2 2 0 012 2v.762c.503.22.978.49 1.419.804l.656-.394a2 2 0 012.744.684l1.193 1.985a2 2 0 01-.684 2.745l-.656.394a7.969 7.969 0 010 2.04l.654.394a2 2 0 01.684 2.744l-1.192 1.985a2 2 0 01-2.745.684l-.654-.393a7.876 7.876 0 01-1.419.804V20a2 2 0 01-2 2h-2.316a2 2 0 01-2-2v-.762a7.882 7.882 0 01-1.418-.804l-.656.394a2 2 0 01-2.744-.684l-1.193-1.985a2 2 0 01.684-2.745zm6.128-6.82l1.2-.523V4h2.315v2.07l1.2.525c.374.163.728.365 1.058.6l1.068.76 1.779-1.069 1.193 1.985-1.777 1.068.167 1.297a5.966 5.966 0 010 1.528l-.167 1.297 1.775 1.067-1.193 1.985-1.778-1.069-1.067.761c-.33.235-.684.437-1.058.6l-1.2.524V20h-2.316v-2.07l-1.199-.525a5.883 5.883 0 01-1.058-.6l-1.068-.76-1.779 1.069-1.193-1.985 1.777-1.068-.167-1.297a5.97 5.97 0 010-1.528l.167-1.297-1.775-1.067 1.192-1.985 1.778 1.069 1.068-.761c.33-.235.684-.437 1.058-.6z"
            clipRule="evenodd"
        />
    </svg>
);
