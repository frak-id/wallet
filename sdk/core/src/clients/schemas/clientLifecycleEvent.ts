import type { Sia } from "@timeleap/sia";

export interface ClientLifecycleCustomCssEvent {
    clientLifecycle: string;
    data: ClientLifecycleCustomCssEventData;
}

export function encodeClientLifecycleCustomCssEvent(
    sia: Sia,
    clientLifecycleCustomCssEvent: ClientLifecycleCustomCssEvent
): Sia {
    sia.addString8(clientLifecycleCustomCssEvent.clientLifecycle);
    encodeClientLifecycleCustomCssEventData(
        sia,
        clientLifecycleCustomCssEvent.data
    );
    return sia;
}

export function decodeClientLifecycleCustomCssEvent(
    sia: Sia
): ClientLifecycleCustomCssEvent {
    return {
        clientLifecycle: sia.readString8(),
        data: decodeClientLifecycleCustomCssEventData(sia),
    };
}

export interface ClientLifecycleCustomCssEventData {
    cssLink: string;
}

export function encodeClientLifecycleCustomCssEventData(
    sia: Sia,
    clientLifecycleCustomCssEventData: ClientLifecycleCustomCssEventData
): Sia {
    sia.addString8(clientLifecycleCustomCssEventData.cssLink);
    return sia;
}

export function decodeClientLifecycleCustomCssEventData(
    sia: Sia
): ClientLifecycleCustomCssEventData {
    return {
        cssLink: sia.readString8(),
    };
}

export interface ClientLifecycleRestoreBackupEvent {
    clientLifecycle: string;
    data: ClientLifecycleRestoreBackupEventData;
}

export function encodeClientLifecycleRestoreBackupEvent(
    sia: Sia,
    clientLifecycleRestoreBackupEvent: ClientLifecycleRestoreBackupEvent
): Sia {
    sia.addString8(clientLifecycleRestoreBackupEvent.clientLifecycle);
    encodeClientLifecycleRestoreBackupEventData(
        sia,
        clientLifecycleRestoreBackupEvent.data
    );
    return sia;
}

export function decodeClientLifecycleRestoreBackupEvent(
    sia: Sia
): ClientLifecycleRestoreBackupEvent {
    return {
        clientLifecycle: sia.readString8(),
        data: decodeClientLifecycleRestoreBackupEventData(sia),
    };
}

export interface ClientLifecycleRestoreBackupEventData {
    backup: string;
}

export function encodeClientLifecycleRestoreBackupEventData(
    sia: Sia,
    clientLifecycleRestoreBackupEventData: ClientLifecycleRestoreBackupEventData
): Sia {
    sia.addString8(clientLifecycleRestoreBackupEventData.backup);
    return sia;
}

export function decodeClientLifecycleRestoreBackupEventData(
    sia: Sia
): ClientLifecycleRestoreBackupEventData {
    return {
        backup: sia.readString8(),
    };
}

export interface ClientLifecycleHearbeatEvent {
    clientLifecycle: string;
}

export function encodeClientLifecycleHearbeatEvent(
    sia: Sia,
    clientLifecycleHearbeatEvent: ClientLifecycleHearbeatEvent
): Sia {
    sia.addString8(clientLifecycleHearbeatEvent.clientLifecycle);
    return sia;
}

export function decodeClientLifecycleHearbeatEvent(
    sia: Sia
): ClientLifecycleHearbeatEvent {
    return {
        clientLifecycle: sia.readString8(),
    };
}

export interface ClientLifecycleHandshakeResponse {
    clientLifecycle: string;
    data: ClientLifecycleHandshakeResponseData;
}

export function encodeClientLifecycleHandshakeResponse(
    sia: Sia,
    clientLifecycleHandshakeResponse: ClientLifecycleHandshakeResponse
): Sia {
    sia.addString8(clientLifecycleHandshakeResponse.clientLifecycle);
    encodeClientLifecycleHandshakeResponseData(
        sia,
        clientLifecycleHandshakeResponse.data
    );
    return sia;
}

export function decodeClientLifecycleHandshakeResponse(
    sia: Sia
): ClientLifecycleHandshakeResponse {
    return {
        clientLifecycle: sia.readString8(),
        data: decodeClientLifecycleHandshakeResponseData(sia),
    };
}

export interface ClientLifecycleHandshakeResponseData {
    token: string;
    currentUrl: string;
}

export function encodeClientLifecycleHandshakeResponseData(
    sia: Sia,
    clientLifecycleHandshakeResponseData: ClientLifecycleHandshakeResponseData
): Sia {
    sia.addString8(clientLifecycleHandshakeResponseData.token);
    sia.addString8(clientLifecycleHandshakeResponseData.currentUrl);
    return sia;
}

export function decodeClientLifecycleHandshakeResponseData(
    sia: Sia
): ClientLifecycleHandshakeResponseData {
    return {
        token: sia.readString8(),
        currentUrl: sia.readString8(),
    };
}
