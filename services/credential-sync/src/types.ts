import type { Binary } from "mongodb";

export type MongoAuthenticator = Readonly<{
    _id: string;
    smartWalletAddress?: string;
    userAgent: string;
    publicKey: {
        x: string;
        y: string;
    };
    credentialPublicKey: Binary;
    counter: number;
    credentialDeviceType: string;
    credentialBackedUp: boolean;
    transports?: string[];
}>;
