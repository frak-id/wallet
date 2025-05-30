import type { SVGProps } from "react";

export const Community = (props: SVGProps<SVGSVGElement>) => {
    const { color, ...rest } = props;
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="35"
            height="26"
            fill="none"
            viewBox="0 0 35 26"
            {...rest}
        >
            <title>Community</title>
            <g stroke="inherit">
                <path
                    strokeWidth="2"
                    d="M17.75 3.37c-2.606 0-4.728 2.165-4.728 4.782s2.122 4.78 4.728 4.78 4.728-2.162 4.728-4.78c0-2.617-2.122-4.782-4.728-4.782zM15.288 15.1c-1.637 0-3.029.855-3.925 2.026-.897 1.17-1.379 2.654-1.379 4.166v.837c0 1.56 1.276 2.87 2.843 2.87h9.836c1.566 0 2.845-1.31 2.845-2.87v-.837c0-1.512-.481-2.996-1.378-4.166s-2.292-2.027-3.929-2.027z"
                />
                <g strokeWidth="1.8">
                    <path d="M28.02 1c-1.585 0-2.872 1.329-2.872 2.906S26.435 6.81 28.02 6.81c1.585 0 2.871-1.328 2.871-2.905S29.604 1 28.02 1zm-1.218 8.994a1.206 1.206 0 00-.612 2.248c1.37.802 2.39 2.644 2.797 4.168h.001c.14.528.617.895 1.163.895h1.53c1.254 0 2.24-1.07 2.24-2.292v-.55c0-1.073-.322-2.113-.953-2.96-.63-.847-1.652-1.51-2.851-1.51zM7.291 1.215c-1.652 0-2.996 1.385-2.996 3.03 0 1.647 1.344 3.031 2.996 3.031s2.996-1.384 2.996-3.03-1.344-3.03-2.996-3.03zm-2.097 9.117c-1.201 0-2.223.662-2.852 1.51a4.952 4.952 0 00-.961 2.96v.55c0 1.223.994 2.292 2.25 2.292h1.215a1.201 1.201 0 001.166-.896c.375-1.398 1.68-3.336 3.101-4.168a1.205 1.205 0 00-.604-2.248z" />
                </g>
            </g>
        </svg>
    );
};
