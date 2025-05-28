import { type Static, ValidationError, t as elysiaTypes } from "elysia";
import { type Address, type Hex, isAddress, isHex } from "viem";

type TElysiaString = ReturnType<typeof elysiaTypes.String>;

const FrakType = {
    /**
     * Custom address type
     */
    AddressType: () => {
        const schema = elysiaTypes.String({
            pattern: "0x[0-9a-fA-F]{40}",
        }) as TElysiaString & { static: Hex };

        return elysiaTypes
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
        const schema = elysiaTypes.String({
            pattern: "0x[0-9a-fA-F]*",
        }) as TElysiaString & { static: Hex };

        return elysiaTypes
            .Transform(schema)
            .Decode((value) => {
                if (value && !isHex(value)) {
                    throw new ValidationError("property", schema, value);
                }
                return value as Hex;
            })
            .Encode((value) => value as Hex);
    },
};

const TokenAmountType = elysiaTypes.Object({
    amount: elysiaTypes.Number(),
    eurAmount: elysiaTypes.Number(),
    usdAmount: elysiaTypes.Number(),
    gbpAmount: elysiaTypes.Number(),
});

type TokenAmount = Static<typeof TokenAmountType>;

const t = Object.assign(elysiaTypes, {
    Address: FrakType.AddressType,
    Hex: FrakType.HexType,
    TokenAmount: TokenAmountType,
});

/**
 * Export our new type system
 */
export { t, type TokenAmount };
