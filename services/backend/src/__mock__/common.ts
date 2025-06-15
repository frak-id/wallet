import { mock } from "bun:test";
import { viemMocks } from "./viem";

// Logger
mock.module("../common", () => ({
    log: {
        debug: mock(() => {}),
        info: mock(() => {}),
        error: mock(() => {}),
        warn: mock(() => {}),
    },
    viemClient: viemMocks,
}));

// Web push
export const webPushMocks = {
    sendNotification: mock(() => Promise.resolve()),
    setVapidDetails: mock(() => {}),
};
mock.module("web-push", () => webPushMocks);
