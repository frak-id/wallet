import type { AuthenticationResponseJSON } from "@simplewebauthn/browser";
import { atomWithStorage } from "jotai/utils";
import type { Address } from "viem";

type LastWebAuthNAction = {
    wallet: Address;
    signature: AuthenticationResponseJSON;
    msg: string;
};

export const lastWebAuthNActionAtom =
    atomWithStorage<LastWebAuthNAction | null>("frak_lastWebAuthNAction", null);
