import { EventEmitter } from "node:events";
import type { NotificationEvent } from "../../domain/notifications/events";
import { infraMetrics } from "../telemetry/infraMetrics";

export type FrakEvents = {
    newInteraction: [];
    newPendingRewards: [{ count: number }];
    notification: [NotificationEvent];
};

export const eventEmitter = new EventEmitter<FrakEvents>({
    captureRejections: true,
});

// Count every emit from a single choke point (cheap: one counter inc per
// event) rather than instrumenting each call site across the domains.
const originalEmit = eventEmitter.emit.bind(eventEmitter);
eventEmitter.emit = ((event: keyof FrakEvents, ...args: unknown[]) => {
    infraMetrics.domainEventEmitted(event as string);
    return originalEmit(event, ...(args as never));
}) as typeof eventEmitter.emit;
