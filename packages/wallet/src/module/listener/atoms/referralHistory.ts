import { atomWithStorage } from "jotai/utils";
import type { Address, Hex } from "viem";

type ContentId = Hex;
type ReferralHistory = {
    contents: { [key: ContentId]: Address };
    lastReferrer: Address;
};

/**
 * Atom representing the referral history
 */
export const referralHistoryAtom = atomWithStorage<ReferralHistory>(
    "referralHistory",
    {
        contents: {},
        lastReferrer: "0x00",
    }
);
