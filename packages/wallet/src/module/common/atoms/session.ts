import type { Session } from "@/types/Session";
import { atom } from "jotai/index";

export const sessionAtom = atom<Session | null>(null);
