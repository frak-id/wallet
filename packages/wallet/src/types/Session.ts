import type { WebAuthNWallet } from "@/types/WebAuthN";

export type Session = WebAuthNWallet & {
    token?: string;
};

export type InteractionSession = {
    sessionStart: number;
    sessionEnd: number;
};

export type SdkSession = {
    token: string;
    expires: number;
};
