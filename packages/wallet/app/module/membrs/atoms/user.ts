import type { User } from "@/types/User";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

/**
 * User atom
 */
export const userAtom = atom<User | null>(null);

/**
 * User choose to setup his profile later
 */
export const userSetupLaterAtom = atomWithStorage<boolean | null>(
    "frak_userSetupLater",
    null
);
