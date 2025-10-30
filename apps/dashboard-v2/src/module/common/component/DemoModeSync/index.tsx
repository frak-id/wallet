import { useDemoMode } from "@/module/common/atoms/demoMode";

/**
 * Component to sync demo mode state to cookies
 * Should be rendered in the root layout to ensure sync happens on all pages
 */
export function DemoModeSync() {
    // This hook will sync to cookies via useEffect
    useDemoMode();
    return null;
}
