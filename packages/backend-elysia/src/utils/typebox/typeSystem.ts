import type { TString } from "@sinclair/typebox";
import { ValidationError, t as elysiaTypes } from "elysia";
import { type Address, type Hex, isAddress, isHex } from "viem";

/**
 * Start our new type system with the elysia types
 */
const t = Object.assign({}, elysiaTypes);

const FrakType = {
    /**
     * Custom address type
     */
    AddressType: () => {
        const schema = t.String({
            pattern: "0x[0-9a-fA-F]{40}",
        }) as TString & { static: Address };

        return t
            .Transform(schema)
            .Decode((value) => {
                if (value && !isAddress(value)) {
                    throw new ValidationError("property", schema, value);
                }
                return value as Address;
            })
            .Encode((value) => value as Address);
    },
    /**
     * Custom hex type
     */
    HexType: () => {
        const schema = t.String({
            pattern: "0x[0-9a-fA-F]*",
        }) as TString & { static: Hex };

        return t
            .Transform(schema)
            .Decode((value) => {
                if (value && !isHex(value)) {
                    throw new ValidationError("property", schema, value);
                }
                return value as Hex;
            })
            .Encode((value) => value as Hex);
    },
    /**
     * Type for the amount of tokens
     */
    TokenAmountType: () => {
        return t.Object({
            amount: t.Number(),
            eurAmount: t.Number(),
            usdAmount: t.Number(),
            gbpAmount: t.Number(),
        });
    },
};

declare module "@sinclair/typebox" {
    interface JavaScriptTypeBuilder {
        Address: typeof FrakType.AddressType;
        Hex: typeof FrakType.HexType;
        TokenAmount: typeof FrakType.TokenAmountType;
    }
}

t.Address = FrakType.AddressType;
t.Hex = FrakType.HexType;
t.TokenAmount = FrakType.TokenAmountType;
/**
 * Export our new type system
 */
export { t };
