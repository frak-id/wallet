/**
 * Check if we are running locally or not
 */
export const isRunningLocally = !["dev", "prod"].includes(
    process.env.STAGE ?? ""
);
