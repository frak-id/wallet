import type { HTMLAttributes, ReactNode } from "react";
import { cloneElement, isValidElement } from "react";

export function mergeElement<P extends HTMLAttributes<HTMLElement>>(
    element: ReactNode,
    newProps: Partial<P>
): ReactNode {
    // Check if the input is a valid React element
    if (!isValidElement(element)) {
        return element;
    }

    // Clone the element with the new props
    return cloneElement(element, newProps);
}
