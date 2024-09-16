import { Duration } from "aws-cdk-lib";
import {
    AllowedMethods,
    CacheCookieBehavior,
    CacheHeaderBehavior,
    CachePolicy,
    CacheQueryStringBehavior,
    CachedMethods,
    OriginProtocolPolicy,
    OriginRequestPolicy,
    ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { HttpOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { Vpc } from "aws-cdk-lib/aws-ec2";
import { Cluster } from "aws-cdk-lib/aws-ecs";
import { ApplicationLoadBalancer } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import type { Stack } from "sst/constructs";
import { Distribution } from "sst/constructs/Distribution.js";
import { isDevStack, isDistantStack } from "../utils";

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
    // Create our CDN cache policy
    const cachePolicy = new CachePolicy(stack, "CachePolicy", {
        queryStringBehavior: CacheQueryStringBehavior.all(),
        headerBehavior: CacheHeaderBehavior.none(),
        cookieBehavior: CacheCookieBehavior.none(),
        defaultTtl: Duration.days(0),
        maxTtl: Duration.days(365),
        minTtl: Duration.days(0),
        enableAcceptEncodingBrotli: true,
        enableAcceptEncodingGzip: true,
        comment: "Nexus response cache policy",
    });

    // Add the cloudfront distribution
    const distribution = new Distribution(stack, "Distribution", {
        customDomain: {
            domainName: isDevStack(stack)
                ? "backend-dev.frak.id"
                : "backend.frak.id",
            hostedZone: "frak.id",
        },
        cdk: {
            distribution: {
                defaultRootObject: "",
                defaultBehavior: {
                    viewerProtocolPolicy:
                        ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    origin: new HttpOrigin(alb.loadBalancerDnsName, {
                        protocolPolicy: OriginProtocolPolicy.HTTP_ONLY,
                        readTimeout: Duration.seconds(60),
                    }),
                    allowedMethods: AllowedMethods.ALLOW_ALL,
                    cachedMethods: CachedMethods.CACHE_GET_HEAD_OPTIONS,
                    compress: true,
                    cachePolicy,
                    originRequestPolicy: OriginRequestPolicy.ALL_VIEWER,
                },
            },
        },
    });

    stack.addOutputs({
        DistributionId: distribution.cdk.distribution.distributionId,
        DistributionUrl: distribution.url,
    });

    return {
        vpc,
        cluster,
        alb,
    };
}
