import type { WebAuthNWallet } from "@/types/WebAuthN";

export type Session = {
    username: string;
    wallet: WebAuthNWallet;
};
