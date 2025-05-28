import { Elysia } from "elysia";
import { webhookRoutes } from "./routes/webhook";

export const interactions = new Elysia({
    prefix: "/interactions",
}).use(webhookRoutes);

export {
    interactionsContext,
    type InteractionsDb,
    type InteractionsContextApp,
} from "./context";
export {
    backendTrackerTable,
    pendingInteractionsTable,
    interactionsPurchaseTrackerTable,
    pushedInteractionsTable,
} from "./db/schema";
export { InteractionRequestDto } from "./dto/InteractionDto";
export { InteractionPackerRepository } from "./repositories/InteractionPackerRepository";
export { InteractionSignerRepository } from "./repositories/InteractionSignerRepository";
export { WalletSessionRepository } from "./repositories/WalletSessionRepository";
export { PreparedInteraction } from "./types/interactions";
