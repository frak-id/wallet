import type { Hex } from "viem";

/**
 * In memory pub / sub repository
 *  - Should be moved to redis instead of in memory, won't support nicely multiple instances
 */
export class PubSubRepository {
    private readonly subscribers: {
        [Topic in PubSubTopics]?: Array<{
            key: string;
            callback: (args: PubSubCallbackArgs<Topic>) => Promise<void>;
        }>;
    };

    constructor() {
        this.subscribers = {};
    }

    /**
     * Subscribe to a specific topic
     * @param topic - The topic to subscribe to
     * @param key - The unique key for this subscriber
     * @param callback - The callback that will be invoked when a message is published to the topic
     */
    public subscribe<Topic extends PubSubTopics>(
        topic: Topic,
        key: string,
        callback: (args: PubSubCallbackArgs<Topic>) => Promise<void>
    ): () => void {
        if (!this.subscribers[topic]) {
            this.subscribers[topic] = [];
        }

        // Remove previous subscription with the same key if some
        this.unsubscribe(topic, key);

        // Then add the new subscriber
        this.subscribers[topic]?.push({ key, callback });

        // Return a function to unsubscribe
        return () => this.unsubscribe(topic, key);
    }

    /**
     * Unsubscribe from a specific topic
     * @param topic - The topic to unsubscribe from
     * @param key - The key to remove
     */
    private unsubscribe<Topic extends PubSubTopics>(topic: Topic, key: string) {
        if (!this.subscribers[topic]) return;

        this.subscribers[topic] = this.subscribers[topic]?.filter(
            (subscriber) => subscriber.key !== key
        );
    }

    /**
     * Publish a message to a specific topic
     * @param topic - The topic to publish to
     * @param args - The arguments to send to the subscribers
     */
    public async publish<Topic extends PubSubTopics>({
        topic,
        args,
    }: { topic: Topic; args: PubSubCallbackArgs<Topic> }) {
        if (!this.subscribers[topic]) return;

        for (const subscriber of this.subscribers[topic] ?? []) {
            await subscriber.callback(args);
        }
    }
}

/**
 * Definition of each pub sub topics
 */
export type PubSubTopicsDefinition = {
    purchaseOracleSync: {
        subscriberCallbackArgs: {
            productId: Hex;
        };
    };
};

/**
 * List of all the topics
 */
export type PubSubTopics = keyof PubSubTopicsDefinition;

/**
 * Args to be sent to the callback method for a given topic
 */
export type PubSubCallbackArgs<Topic extends PubSubTopics> =
    PubSubTopicsDefinition[Topic]["subscriberCallbackArgs"];
