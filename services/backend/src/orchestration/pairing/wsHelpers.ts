import type { ElysiaWS } from "elysia/ws";
import type { WsTopicMessage } from "../../domain/pairing/dto/WebsocketTopicMessage";
import type { PairingRepository } from "../../domain/pairing/repositories/PairingRepository";
import { originTopic, targetTopic } from "../../domain/pairing/topics";

// Shared by PairingOrchestrator and PairingRouterOrchestrator.
export function sendTopic(
    ws: ElysiaWS,
    pairingRepository: PairingRepository,
    pairingId: string,
    message: WsTopicMessage,
    topic: "origin" | "target",
    opts: { skipLastActiveUpdate?: boolean } = {}
): void {
    if (!opts.skipLastActiveUpdate) {
        pairingRepository.touchLastActiveBatched(pairingId);
    }
    ws.publish(
        topic === "origin" ? originTopic(pairingId) : targetTopic(pairingId),
        message
    );
}
