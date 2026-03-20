import { t } from "@backend-utils";
import type { Static } from "elysia";

export const NotificationTypeSchema = t.Union([
    t.Literal("promotional"),
    t.Literal("reward_pending"),
    t.Literal("reward_settled"),
]);
export type NotificationType = Static<typeof NotificationTypeSchema>;

export const NotificationStatusSchema = t.Union([
    t.Literal("sent"),
    t.Literal("opened"),
]);
export type NotificationStatus = Static<typeof NotificationStatusSchema>;
