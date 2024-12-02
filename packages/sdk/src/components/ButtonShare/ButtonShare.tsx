import { useCallback, useEffect, useState } from "preact/hooks";
import { onClientReady } from "../utils";

type ButtonShareProps = {
    text: string;
    classname?: string;
};

function modalShare() {
    window.FrakSetup.modalBuilderSteps
        .sharing(window.FrakSetup.modalShareConfig)
        .display();
}

export function ButtonShare({
    text = "Share and earn!",
    classname = "",
}: ButtonShareProps) {
    const [disabled, setDisabled] = useState(true);

    const handleClientReady = useCallback(() => {
        setDisabled(false);
    }, []);

    useEffect(() => {
        onClientReady("add", handleClientReady);
        return () => onClientReady("remove", handleClientReady);
    }, [handleClientReady]);

    return (
        <button
            type={"button"}
            class={classname}
            disabled={disabled}
            onClick={modalShare}
        >
            {text}
        </button>
    );
}
