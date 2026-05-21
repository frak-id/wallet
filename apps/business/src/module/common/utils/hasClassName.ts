import type { ReactElement } from "react";

export const hasClassName = (
    element: ReactElement
): element is ReactElement & { props: { className: string } } => {
    return (
        "props" in element &&
        typeof element.props === "object" &&
        element.props !== null &&
        "className" in element.props &&
        typeof element.props.className === "string"
    );
};
