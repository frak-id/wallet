import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin";

/**
 * The tools for the rslib config
 */
export const tools = {
    rspack: {
        plugins: [
            process.env.RSDOCTOR === "true"
                ? new RsdoctorRspackPlugin()
                : undefined,
        ].filter(Boolean),
    },
};
