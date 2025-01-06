import type { IFrameRpcEvent } from "../../types/transport";

/**
 * Represent an IFrame channel manager
 */
type IFrameChannelResolver = (message: IFrameRpcEvent) => Promise<void>;

/**
 * Represent an IFrame channel id
 */
type IFrameChannelId = string;

/**
 * Represent an IFrame channel manager
 * @ignore
 */
export type IFrameChannelManager = {
    /**
     * Create a new channel
     */
    createChannel: (resolver: IFrameChannelResolver) => IFrameChannelId;
    /**
     * Check if a channel exists
     */
    getRpcResolver: (id: IFrameChannelId) => IFrameChannelResolver | undefined;
    /**
     * Destroy the channel manager
     */
    removeChannel: (id: IFrameChannelId) => void;
    /**
     * Destroy the channel manager
     */
    destroy: () => void;
};

/**
 * Create a new IFrame channel manager
 * @ignore
 */
export function createIFrameChannelManager(): IFrameChannelManager {
    const channels: Map<IFrameChannelId, IFrameChannelResolver> = new Map();

    return {
        // TODO: Better id system?? uid stuff?
        createChannel: (resolver: IFrameChannelResolver) => {
            const id = Math.random().toString(36).substring(7);
            channels.set(id, resolver);
            return id;
        },
        getRpcResolver: (id: IFrameChannelId) => channels.get(id),
        removeChannel: (id: IFrameChannelId) => channels.delete(id),
        destroy: () => channels.clear(),
    };
}
