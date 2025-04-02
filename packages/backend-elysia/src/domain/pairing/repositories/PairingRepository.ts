import { eq } from "drizzle-orm";
import type { ElysiaWS } from "elysia/ws";
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
    }: {
        ws: ElysiaWS;
        pairingId: string;
        message: WsTopicMessage;
    }) {
        await this.updatePairingLastActive({ pairingId });
        ws.publish(`pairing:${pairingId}`, message);
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
