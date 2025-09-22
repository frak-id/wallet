import { NotificationsService } from "./services/NotificationsService";

export namespace NotificationContext {
    export const services = {
        notifications: new NotificationsService(),
    };
}
