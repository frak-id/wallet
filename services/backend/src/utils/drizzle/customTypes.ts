import { customType } from "drizzle-orm/pg-core";
import { type Hex, bytesToHex, hexToBytes } from "viem";

/**
 * Custom fierld used to store hex values
 */
export const customHex = customType<{ data: Hex; driverData: Buffer }>({
    dataType() {
        return "bytea";
    },
    fromDriver(value: Buffer) {
        return bytesToHex(value);
    },
    toDriver(value: Hex) {
        return Buffer.from(hexToBytes(value));
    },
});
