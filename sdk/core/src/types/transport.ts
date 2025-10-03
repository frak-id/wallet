import type { LifecycleMessage, RpcClient } from "@frak-labs/frame-connector";
import type { ClientLifecycleEvent, IFrameLifecycleEvent } from "./lifecycle";
import type { IFrameRpcSchema } from "./rpc";

/**
 * IFrame transport interface
 */
export type IFrameTransport = {
    /**
     * Wait for the connection to be established
     */
    waitForConnection: Promise<boolean>;
    /**
     * Wait for the setup to be done
     */
    waitForSetup: Promise<void>;
    /**
     * Function used to perform a single request via the iframe transport
     */
    request: RpcClient<IFrameRpcSchema, LifecycleMessage>["request"];
    /**
     * Function used to listen to a request response via the iframe transport
     */
    listenerRequest: RpcClient<IFrameRpcSchema, LifecycleMessage>["listen"];
    /**
     * Function used to destroy the iframe transport
     */
    destroy: () => Promise<void>;
};

/**
 * Represent an iframe event
 */
export type FrakLifecycleEvent = IFrameLifecycleEvent | ClientLifecycleEvent;
