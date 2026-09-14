import { Binary } from "mongodb";

export type MongoAuthenticator = Readonly<{
    _id: string;
    smartWalletAddress?: string;
    userAgent: string;
    publicKey: {
        x: string;
        y: string;
    };
    credentialPublicKey: Binary | Buffer | Uint8Array | string;
    counter: number;
    credentialDeviceType: string;
    credentialBackedUp: boolean;
    transports?: string[];
}>;

/** The credential wire encoding, shared by the writer and the verifier. */
export function toBase64(value: Binary | Buffer | Uint8Array | string): string {
    if (typeof value === "string") return value;
    if (value instanceof Binary)
        return Buffer.from(value.buffer).toString("base64");
    return Buffer.from(value).toString("base64");
}
