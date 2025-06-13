export const hasClassName = (
    element: React.ReactElement
): element is React.ReactElement & { props: { className: string } } => {
    return (
        "props" in element &&
        typeof element.props === "object" &&
        element.props !== null &&
        "className" in element.props &&
        typeof element.props.className === "string"
    );
};
