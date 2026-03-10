import { FcmSender } from "./services/FcmSender";
import { NotificationsService } from "./services/NotificationsService";

const fcmSender = new FcmSender();

export namespace NotificationContext {
    export const services = {
        notifications: new NotificationsService(fcmSender),
    };
}
