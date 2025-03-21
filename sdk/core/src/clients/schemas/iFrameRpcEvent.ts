import type { Sia } from "@timeleap/sia";

export interface IFrameRpcEvent {
    id: string;
    topic: string;
    data: string;
}

export function encodeIFrameRpcEvent(
    sia: Sia,
    iFrameRpcEvent: IFrameRpcEvent
): Sia {
    sia.addString8(iFrameRpcEvent.id);
    sia.addString8(iFrameRpcEvent.topic);
    sia.addString16(iFrameRpcEvent.data);
    return sia;
}

export function decodeIFrameRpcEvent(sia: Sia): IFrameRpcEvent {
    return {
        id: sia.readString8(),
        topic: sia.readString8(),
        data: sia.readString16(),
    };
}
