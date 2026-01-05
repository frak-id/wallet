import { t as elysiaTypes } from "elysia";
import { type Address, isAddress } from "viem";

type TElysiaString = ReturnType<typeof elysiaTypes.String>;

const customTypes = {
    AddressType: () => {
        const schema = elysiaTypes.String({
            pattern: "0x[0-9a-fA-F]{40}",
        }) as TElysiaString & { static: Address };

        return elysiaTypes
            .Transform(schema)
            .Decode((value) => {
                if (value && !isAddress(value)) {
                    throw new Error("Invalid address format");
                }
                return value as Address;
            })
            .Encode((value) => value as Address);
    },

    HexType: () => {
        const schema = elysiaTypes.String({
            pattern: "0x[0-9a-fA-F]*",
        }) as TElysiaString;

        return elysiaTypes.Transform(schema).Decode((value) => {
            if (value && !value.startsWith("0x")) {
                throw new Error("Invalid hex format");
            }
            return value;
        });
    },
};

export const t = Object.assign(elysiaTypes, customTypes);
