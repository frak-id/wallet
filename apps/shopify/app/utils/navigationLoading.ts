type NavigationState = "idle" | "loading" | "submitting";

type ShouldShowOutletSkeletonArgs = {
    currentPathname: string;
    navigationState: NavigationState;
    nextPathname: string | null;
};

export function shouldShowOutletSkeleton({
    currentPathname,
    navigationState,
    nextPathname,
}: ShouldShowOutletSkeletonArgs) {
    if (navigationState === "idle") {
        return false;
    }

    if (!nextPathname) {
        return false;
    }

    return nextPathname !== currentPathname;
}
