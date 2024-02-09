import humanizeDuration from "humanize-duration";

/**
 * Format a duration in seconds to a human readable format
 * @param duration
 */
export const formatSecondDuration = (duration: number) =>
    humanizeDuration(duration * 1000, {
        round: true,
        largest: 2,
    });
