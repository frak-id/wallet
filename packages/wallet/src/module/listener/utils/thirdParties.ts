import { Deferred } from "@frak-labs/nexus-sdk/core";

/**
 * Get the current storage status
 */
export function getSharedStorageAccessStatus() {
    // Build our return promise
    const deferred = new Deferred<boolean>();

    if (typeof window === "undefined" || !("FrakStorageCheck" in window)) {
        deferred.resolve(false);
        return deferred.promise;
    }

    const storageCheck = window.FrakStorageCheck as { hasAccess?: boolean };

    // Check for the meta and get its data attribute
    //  Only return if previously true
    if (storageCheck?.hasAccess) {
        deferred.resolve(true);
        return deferred.promise;
    }

    // Otherwise, recheck from the document
    document.hasStorageAccess().then((hasAccess) => {
        // Resolve our deferred promise
        deferred.resolve(hasAccess);

        // If we still don't have access, do nothing
        if (!hasAccess) return;

        // Otherwise, update the meta tag
        storageCheck.hasAccess = true;
    });

    // Return our promise
    return deferred.promise;
}
