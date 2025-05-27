import { Elysia } from "elysia";
import { pushTokensRoutes } from "./routes/pushTokens";

export const notifications = new Elysia({
    prefix: "/notifications",
}).use(pushTokensRoutes);

export { NotificationsService } from "./services/NotificationsService";
export {
    SendNotificationPayloadDto,
    SendNotificationTargetsDto,
    type SendNotificationPayload,
} from "./dto/SendNotificationDto";
export { notificationContext } from "./context";
