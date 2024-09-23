import { Vpc } from "aws-cdk-lib/aws-ec2";
import { Cluster } from "aws-cdk-lib/aws-ecs";
import type { StackContext } from "sst/constructs";

export function ClusterStack({ stack }: StackContext) {
    // Create the VPC
    const vpc = Vpc.fromLookup(stack, "Vpc", {
        vpcName: "nexus-vpc",
    });

    // Create the cluster that each services will use
    const cluster = new Cluster(stack, "EcsCluster", {
        vpc,
        clusterName: `${stack.stage}-Nexus`,
    });

    return {
        vpc,
        cluster,
    };
}
