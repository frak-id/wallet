import type { HTMLAttributes, ReactNode } from "react";
import { cloneElement, isValidElement } from "react";

export function mergeElement<P extends HTMLAttributes<HTMLElement>>(
    element: ReactNode,
    newProps: Partial<P>
): ReactNode {
    if (!isValidElement(element)) {
        return element;
    }
    return cloneElement(element, newProps);
}
