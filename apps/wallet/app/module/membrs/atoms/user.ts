import type { User } from "@frak-labs/wallet-shared/types/User";
import { atomWithStorage } from "jotai/utils";

/**
 * User atom
 */
export const userAtom = atomWithStorage<User | null>(
    "frak_user",
    null,
    undefined,
    {
        getOnInit: true,
    }
);

/**
 * User choose to setup his profile later
 */
export const userSetupLaterAtom = atomWithStorage<boolean | null>(
    "frak_userSetupLater",
    null,
    undefined,
    {
        getOnInit: true,
    }
);
