import type { User } from "@/types/User";
import { atom } from "jotai";

export const userAtom = atom<User | null>(null);
