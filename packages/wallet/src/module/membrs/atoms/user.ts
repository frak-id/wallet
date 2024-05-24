import type { User } from "@/types/User";
import { atom } from "jotai";

/**
 * User atom
 */
export const userAtom = atom<User | null>(null);

/**
 * User choose to setup his profile later
 */
export const userSetupLaterAtom = atom<boolean | null>(null);
