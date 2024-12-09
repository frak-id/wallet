import type { Service } from "../.sst/platform/src/components/aws/service.js";

/**
 * Get a safe SST service constructor, cause the one in .sst/plateform is not
 */
export const SstService: typeof Service = await import(
    "../.sst/platform/src/components/aws/service.js"
)
    .then((m) => m.Service)
    .catch(() => {
        console.debug("SST Service not found, using a placeholder constructor");
        // @ts-ignore: Not exported in the SST platform
        return sst.aws.Service;
    });
