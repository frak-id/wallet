import type { Sia } from "@timeleap/sia";

export interface IFrameLifecycleEvent {
    iframeLifecycle: string;
}

export function encodeIFrameLifecycleEvent(
    sia: Sia,
    iFrameLifecycleEvent: IFrameLifecycleEvent
): Sia {
    sia.addString8(iFrameLifecycleEvent.iframeLifecycle);
    return sia;
}

export function decodeIFrameLifecycleEvent(sia: Sia): IFrameLifecycleEvent {
    return {
        iframeLifecycle: sia.readString8(),
    };
}
