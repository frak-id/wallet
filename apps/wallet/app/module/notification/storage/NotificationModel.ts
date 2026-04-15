type NotificationPayload = Readonly<
    {
        title: string;
        icon?: string;
        data?: {
            url?: string;
        };
        actions?: {
            action: string;
            title: string;
        }[];
    } & Omit<NotificationOptions, "data">
>;

export type NotificationModel = NotificationPayload & {
    id: string;
    timestamp: number;
};
