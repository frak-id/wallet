import type { SVGProps } from "react";

export const Users = (props: SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="currentColor"
        viewBox="0 0 24 24"
        {...props}
    >
        <title>Members</title>
        <g fill="currentColor">
            <path
                fillRule="evenodd"
                d="M14.5 6.5a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm-2 0a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM2 18.923C2 15.1 5.1 12 8.923 12h2.154C14.9 12 18 15.1 18 18.923 18 20.07 17.07 21 15.923 21H4.077A2.077 2.077 0 012 18.923zm2 0A4.923 4.923 0 018.923 14h2.154A4.923 4.923 0 0116 18.923a.077.077 0 01-.077.077H4.077A.077.077 0 014 18.923z"
                clipRule="evenodd"
            />
            <path d="M18.92 20.097c-.104.401.157.903.571.903h.432C21.07 21 22 20.07 22 18.923 22 15.1 18.9 12 15.077 12c-.142 0-.194.197-.073.273a8.505 8.505 0 012.414 2.261c.044.061.1.113.165.151A4.92 4.92 0 0120 18.923a.077.077 0 01-.077.077h-.474c-.25 0-.449.21-.449.461 0 .22-.028.433-.08.636zM14.919 8.963a.592.592 0 01.254-.255 2.5 2.5 0 000-4.416.592.592 0 01-.254-.255 5.516 5.516 0 00-1.094-1.489C13.623 2.352 13.72 2 14 2a4.5 4.5 0 110 9c-.281 0-.377-.352-.175-.548a5.515 5.515 0 001.094-1.489z" />
        </g>
    </svg>
);
