import { eq } from "drizzle-orm";
import type { ElysiaWS } from "elysia/ws";
import { log } from "../../../common";
import type { PairingDb } from "../context";
import { pairingTable } from "../db/schema";
import type { WsDirectMessageResponse } from "../dto/WebsocketDirectMessage";
import type { WsTopicMessage } from "../dto/WebsocketTopicMessage";

export abstract class PairingRepository {
    constructor(protected readonly pairingDb: PairingDb) {}

    /**
     * Send a direct msg to the websocket client
     * @internal
     */
    protected sendDirectMessage({
        ws,
        message,
    }: {
        ws: ElysiaWS;
        message: WsDirectMessageResponse;
    }) {
        ws.send(message);
    }

    /**
     * Send a topic message to the websocket client
     * @internal
     */
    protected async sendTopicMessage({
        ws,
        pairingId,
        message,
        topic,
        skipUpdate = false,
    }: {
        ws: ElysiaWS;
        pairingId: string;
        message: WsTopicMessage;
        topic: "origin" | "target";
        skipUpdate?: boolean;
    }) {
        if (!skipUpdate) {
            await this.updatePairingLastActive({ pairingId });
        }
        log.debug(
            {
                type: message.type,
                formattedTopic:
                    topic === "origin"
                        ? originTopic(pairingId)
                        : targetTopic(pairingId),
            },
            "Sending topic message"
        );
        ws.publish(
            topic === "origin"
                ? originTopic(pairingId)
                : targetTopic(pairingId),
            message
        );
    }

    /**
     * Update a pairing last active timestamp
     */
    private async updatePairingLastActive({
        pairingId,
    }: {
        pairingId: string;
    }) {
        await this.pairingDb
            .update(pairingTable)
            .set({
                lastActiveAt: new Date(),
            })
            .where(eq(pairingTable.pairingId, pairingId));
    }
}

export function originTopic(pairingId: string) {
    return `pairing:${pairingId}:origin`;
}

export function targetTopic(pairingId: string) {
    return `pairing:${pairingId}:target`;
}
