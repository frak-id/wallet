import { Vpc } from "aws-cdk-lib/aws-ec2";
import { Cluster } from "aws-cdk-lib/aws-ecs";
import { ApplicationLoadBalancer } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import type { Stack } from "sst/constructs";
import { isDistantStack } from "../utils";

/**
 * Define app wide service + ALB
 * @param stack
 * @constructor
 */
export function buildEcsService({ stack }: { stack: Stack }) {
    if (!isDistantStack(stack)) {
        console.error("Services can only be used in distant stacks");
        return undefined;
    }

    const vpc = Vpc.fromLookup(stack, "Vpc", {
        vpcName: "nexus-vpc",
    });

    // Create the cluster for each services
    const cluster = new Cluster(stack, "EcsCluster", {
        vpc,
        clusterName: `${stack.stage}-NexusCluster`,
    });

    // Create our application load balancer
    const alb = new ApplicationLoadBalancer(stack, "Alb", {
        vpc,
        // todo: This should be set to false post debug and testing
        internetFacing: true,
    });

    return {
        vpc,
        cluster,
        alb,
    };
}
