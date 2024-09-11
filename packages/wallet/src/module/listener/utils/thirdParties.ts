/**
 * Request and check the storage access
 */
export async function requestAndCheckStorageAccess() {
    // Check if the user has access to the storage
    const hasAccess = await document.hasStorageAccess();
    if (hasAccess) {
        return true;
    }

    // If he doesn't, request the access and check again
    try {
        await document.requestStorageAccess();
    } catch (err) {
        console.error("Failed to request the storage access", err);
    }
    return await document.hasStorageAccess();
}
