import { EventEmitter } from "node:events";
import type { FrakEvents } from "@backend-utils";

export const eventEmitter = new EventEmitter<FrakEvents>({
    captureRejections: true,
});
