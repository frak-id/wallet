export const tablet = 768;
export const desktop = 1024;
export const breakpointNames = ["mobile", "tablet", "desktop"] as const;

export type Breakpoint = (typeof breakpointNames)[number];
