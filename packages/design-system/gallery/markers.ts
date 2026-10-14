import { createContext } from "react";
import type { Markers } from "./shell";

/** Present only in the shell: case name to the kinds of known finding it has. */
export const FindingMarkers = createContext<Markers | null>(null);
