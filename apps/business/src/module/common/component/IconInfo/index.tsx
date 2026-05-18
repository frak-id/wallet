import type { ComponentPropsWithRef } from "react";
import { iconInfo } from "./icon-info.css";

export const IconInfo = ({ ref, ...props }: ComponentPropsWithRef<"span">) => {
    return (
        <span ref={ref} {...props} className={iconInfo}>
            i
        </span>
    );
};
IconInfo.displayName = "IconInfo";
