import { Secret } from "aws-cdk-lib/aws-ecs";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import type { Config, Stack } from "sst/constructs";

// v3.1.4 is at @opennextjs/aws and isn't supported by SST yet
export const openNextVersion = "3.1.3";

/**
 * Check if we are running in prod or not
 * @param stack
 */
export function isProdStack(stack: Stack): boolean {
    return stack.stage === "prod";
}

/**
 * Check if we are running in dev or not
 * @param stack
 */
export function isDevStack(stack: Stack): boolean {
    return stack.stage === "dev";
}

/**
 * Check if we are running a distant stack
 * @param stack
 */
export function isDistantStack(stack: Stack): boolean {
    return isProdStack(stack) || isDevStack(stack);
}

/**
 * Get the current wallet url
 * @param stack
 */
export function getWalletUrl(stack: Stack): string {
    if (isProdStack(stack)) {
        return "https://wallet.frak.id";
    }
    if (isDevStack(stack)) {
        return "https://wallet-dev.frak.id";
    }
    return "https://localhost:3000";
}

/**
 * Get the current business url
 * @param stack
 */
export function getBusinessUrl(stack: Stack): string {
    if (isProdStack(stack)) {
        return "https://business.frak.id";
    }
    if (isDevStack(stack)) {
        return "https://business-dev.frak.id";
    }
    return "https://localhost:3001";
}

/**
 * Get the current backend url
 * @param stack
 */
export function getBackendUrl(stack: Stack): string {
    if (isProdStack(stack)) {
        return "https://backend.frak.id";
    }
    if (isDevStack(stack)) {
        return "https://backend-dev.frak.id";
    }
    return "http://localhost:3030";
}

/**
 * Extract the ECS secrets from a list of configs
 */
export function extractEcsSecretsFromConfigs(
    stack: Stack,
    configs: Config.Secret[]
): Record<string, Secret> {
    const records = configs.reduce(
        (acc, config) => {
            const useStageValue =
                config.name === "POSTGRES_PASSWORD" && isProdStack(stack);
            const extracted = extractEcsSecretsFromConfig(
                stack,
                config,
                useStageValue
            );
            if (extracted) {
                acc.push(extracted);
            }
            return acc;
        },
        [] as Record<string, Secret>[]
    );

    // Map the records into an object of key values
    return Object.assign({}, ...records);
}

/**
 * Extract the ECS secrets from a config
 * @param stack
 * @param config
 * @param useStageValue
 */
function extractEcsSecretsFromConfig(
    stack: Stack,
    config: Config.Secret,
    useStageValue?: boolean
) {
    const name = config.name;
    const bindings = config.getBindings();
    const getParamPermission = bindings.permissions["ssm:GetParameters"];
    if (!getParamPermission) {
        console.warn(`No permission found for ${name}`);
        return;
    }

    // Then, first index is stage one, second one is fallback
    const secretArn = getParamPermission[useStageValue ? 0 : 1];
    const secretPath = secretArn
        .split(":")
        .slice(-1)[0]
        .replace("parameter", "");

    // Log the config
    const stringParameter = StringParameter.fromSecureStringParameterAttributes(
        stack,
        `${name}Parameter`,
        {
            parameterName: secretPath,
        }
    );
    return { [name]: Secret.fromSsmParameter(stringParameter) };
}

/**
 * Extract the ECS env from a list of configs parameters
 */
export function extractEcsEnvFromConfigs(
    configs: Config.Parameter[]
): Record<string, string> {
    const records = configs.reduce(
        (acc, config) => {
            const extracted = {
                [config.name]: config.value,
            };
            acc.push(extracted);
            return acc;
        },
        [] as Record<string, string>[]
    );

    // Map the records into an object of key values
    return Object.assign({}, ...records);
}
