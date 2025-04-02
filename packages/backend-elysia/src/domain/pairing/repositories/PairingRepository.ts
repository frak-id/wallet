import type { ElysiaWS } from "elysia/ws";
import type { WsDirectMessageResponse } from "../dto/WeboscketDirectMessage";
import type { WsTopicMessage } from "../dto/WeboscketTopicMessage";

export abstract class PairingRepository {
    /**
     * Send a direct msg to the websocket client
     * @internal
     */
    sendDirectMessage({
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
    sendTopicMessage({
        ws,
        pairingId,
        message,
    }: {
        ws: ElysiaWS;
        pairingId: string;
        message: WsTopicMessage;
    }) {
        ws.publish(`pairing:${pairingId}`, message);
    }
}
