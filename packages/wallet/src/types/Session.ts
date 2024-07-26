import type { WebAuthNWallet } from "@/types/WebAuthN";

export type Session = {
    wallet: WebAuthNWallet;
};

export type InteractionSession = {
    sessionStart: number;
    sessionEnd: number;
};
