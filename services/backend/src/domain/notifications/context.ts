import { NotificationBroadcastRepository } from "./repositories/NotificationBroadcastRepository";
import { NotificationSentRepository } from "./repositories/NotificationSentRepository";
import { FcmSender } from "./services/FcmSender";
import { NotificationsService } from "./services/NotificationsService";

const fcmSender = new FcmSender();
const notificationSentRepository = new NotificationSentRepository();
const notificationBroadcastRepository = new NotificationBroadcastRepository();

export namespace NotificationContext {
    export const repositories = {
        notificationSent: notificationSentRepository,
        notificationBroadcast: notificationBroadcastRepository,
    };
    export const services = {
        notifications: new NotificationsService(fcmSender),
    };
}
