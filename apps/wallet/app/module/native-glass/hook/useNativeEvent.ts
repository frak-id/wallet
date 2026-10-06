import { useEffect, useEffectEvent } from "react";
import { onNativeEvent } from "../bridge";

/** Subscribes to a `frak-glass` plugin event for the component's lifetime. */
export function useNativeEvent<Payload>(
    event: string,
    handler: (payload: Payload) => void
) {
    const onEvent = useEffectEvent((payload: Payload) => handler(payload));

    useEffect(
        () => onNativeEvent<Payload>(event, (payload) => onEvent(payload)),
        [event]
    );
}
