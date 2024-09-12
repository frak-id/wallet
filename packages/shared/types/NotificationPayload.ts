/**
 * Payload of a notification
 */
export type NotificationPayload = Readonly<
    {
        title: string;
        data?: {
            url?: string;
        };
        // Waning: not supported on firefox nor safari
        //  see: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification#browser_compatibility
        actions?: {
            action: string;
            title: string;
            icon?: string;
        }[];
    } & Omit<NotificationOptions, "data">
>;
