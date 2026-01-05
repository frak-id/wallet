export class AppError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly statusCode: number = 500,
        public readonly details?: Record<string, unknown>
    ) {
        super(message);
        this.name = "AppError";
        Error.captureStackTrace(this, this.constructor);
    }
}

export const ErrorHandler = (error: unknown) => {
    if (error instanceof AppError) {
        return {
            error: {
                code: error.code,
                message: error.message,
                ...(error.details && { details: error.details }),
            },
            statusCode: error.statusCode,
        };
    }

    if (error instanceof Error) {
        return {
            error: {
                code: "INTERNAL_ERROR",
                message: "An unexpected error occurred",
            },
            statusCode: 500,
        };
    }

    return {
        error: {
            code: "UNKNOWN_ERROR",
            message: "An unknown error occurred",
        },
        statusCode: 500,
    };
};
