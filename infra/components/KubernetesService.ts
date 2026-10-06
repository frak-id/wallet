import * as k8s from "@pulumi/kubernetes";
import type * as inputs from "@pulumi/kubernetes/types/input";
import {
    ComponentResource,
    type ComponentResourceOptions,
    type Input,
    output,
} from "@pulumi/pulumi";
import type {
    DevCommand,
    DevCommandArgs,
} from "../../.sst/platform/src/components/experimental/index.js";
import { normalizedStageName } from "../utils.js";

// SST Command import
const Command: typeof DevCommand = await import(
    "../../.sst/platform/src/components/experimental/index.js"
)
    .then((m) => m.DevCommand)
    .catch(() => {
        console.debug("SST Command not found, using a placeholder constructor");
        return sst.x.DevCommand;
    });

/**
 * Envoy Gateway upstream tuning for a route (or one of its rules), rendered
 * as a BackendTrafficPolicy. Durations are Gateway API strings ("5s").
 */
export type EdgeTraffic = {
    connectTimeout?: string;
    requestTimeout?: string; // "0s" = no total cap, only the idle one
    streamIdleTimeout?: string; // No byte either way for this long
    connectionIdleTimeout?: string; // Must stay below the app's keep-alive
    compression?: boolean; // Brotli/Gzip what the app sends uncompressed
};

type HttpRouteParentRef = {
    group?: Input<string>;
    kind?: Input<string>;
    name: Input<string>;
    namespace?: Input<string>;
    sectionName?: Input<string>;
};

type HttpRouteRule = {
    name: string; // Section name, targeted by rule-level policies
    path: string;
    pathType?: "PathPrefix" | "Exact"; // Default to "PathPrefix"
    backend?: { name: Input<string>; port: Input<number> }; // Default to this service
    traffic?: EdgeTraffic; // Merged over the route's `traffic`
};

/**
 * What ingress-nginx does for us today: 5s connect, no total cap, 60s without
 * a byte. Upstream idle stays below nginx's 75s keep-alive in the SPA pods.
 */
const edgeTrafficDefaults: Required<EdgeTraffic> = {
    connectTimeout: "5s",
    requestTimeout: "0s",
    streamIdleTimeout: "60s",
    connectionIdleTimeout: "60s",
    compression: false,
};

// Only replays requests the app never received, so POSTs are safe too
const edgeRetry = {
    numRetries: 2,
    retryOn: {
        triggers: ["connect-failure", "refused-stream", "reset-before-request"],
    },
};

function trafficPolicySpec(traffic: Required<EdgeTraffic>) {
    // An entry without its (empty) settings object is silently dropped
    const compressor = [
        { type: "Brotli", brotli: {}, minContentLength: "1Ki" },
        { type: "Gzip", gzip: {}, minContentLength: "1Ki" },
    ];
    return {
        // Without it, a route policy replaces the Gateway-level one wholesale
        mergeType: "StrategicMerge",
        timeout: {
            tcp: { connectTimeout: traffic.connectTimeout },
            http: {
                requestTimeout: traffic.requestTimeout,
                streamIdleTimeout: traffic.streamIdleTimeout,
                connectionIdleTimeout: traffic.connectionIdleTimeout,
            },
        },
        retry: edgeRetry,
        ...(traffic.compression ? { compressor } : {}),
    };
}

/**
 * Arguments used to create a Kubernetes service
 */
type KubernetesServiceArgs = {
    // Dev command informations if needed
    dev?: DevCommandArgs;

    // Namespace where the pod should be deployed
    namespace: Input<string>;
    // The app labels
    appLabels: Record<string, string>;

    // Info for the pod deployment
    pod: {
        // The number of replicas
        replicas?: Input<number>; // Default to 1

        // Definition of each container
        containers: Input<inputs.core.v1.Container>[];
    };

    // Info for the service
    service?: {
        ports: Input<
            {
                port: Input<number>;
                targetPort: Input<number>;
                protocol: Input<string>;
                name: Input<string>;
            }[]
        >;
    };

    // Info for the hpa
    hpa?: {
        min?: Input<number>; // Default to 1
        max: Input<number>;
        cpuUtilization?: Input<number>; // Default to 80
    };

    // Info for the ingress
    ingress?: {
        host: Input<string>;
        tlsSecretName: Input<string>;
        additionalHosts?: string[];
        // Additional path-based routes to other services
        pathRoutes?: Array<{
            path: Input<string>;
            pathType?: Input<"Prefix" | "Exact" | "ImplementationSpecific">; // Default to "Prefix"
            serviceName: Input<string>;
            servicePort: Input<number>;
        }>;
        // Custom annotations to add/override
        customAnnotations?: Record<string, Input<string>>;
    };

    // Gateway API route, published next to `ingress` during the migration
    httpRoute?: {
        hostnames: Input<string>[];
        parentRefs: Input<HttpRouteParentRef>[];
        rules?: HttpRouteRule[]; // Matched ahead of the catch-all `/` to this service
        traffic?: EdgeTraffic;
    };

    // Info for the service monitor
    serviceMonitor?: {
        port: Input<string>; // Matching a port defined in the `service.ports[number].name`
        path: Input<string>;
        interval?: Input<string>; // Default to 15
    };
};

/**
 * Deploy a full on kubernetes service with a deployment, service, hpa, ingress and service monitor
 */
export class KubernetesService extends ComponentResource {
    // Resources
    public readonly deployment: k8s.apps.v1.Deployment | null = null;
    public readonly service: k8s.core.v1.Service | null = null;
    public readonly hpa: k8s.autoscaling.v1.HorizontalPodAutoscaler | null =
        null;
    public readonly ingress: k8s.networking.v1.Ingress | null = null;
    public readonly httpRoute: k8s.apiextensions.CustomResource | null = null;
    public readonly serviceMonitor: k8s.apiextensions.CustomResource | null =
        null;
    public readonly devCommand: DevCommand | null = null;

    public readonly labels: Record<string, string>;

    constructor(
        private name: string,
        private args: KubernetesServiceArgs,
        private opts?: ComponentResourceOptions
    ) {
        super("k8s:frak:KubernetesService", name, args, opts);

        this.labels = {
            ...this.args.appLabels,
            environment: normalizedStageName,
        };

        // If we are running locally, just create a dev command
        if ($dev && this.args.dev) {
            this.devCommand = this.createDevCommand();
            return;
        }

        // Create the deployment
        this.deployment = this.createDeployment();

        // Create the service if defined
        if (this.args.service) {
            this.service = this.createService();
        }

        // Create the HPA if defined
        if (this.args.hpa) {
            this.hpa = this.createHPA();
        }

        // Create the ingress if defined
        if (this.args.ingress && this.service) {
            this.ingress = this.createIngress();
        }

        if (this.args.httpRoute && this.service) {
            this.httpRoute = this.createHttpRoute();
        }

        // Create the service monitor if defined
        if (this.args.serviceMonitor && this.service) {
            this.serviceMonitor = this.createServiceMonitor();
        }
    }

    private createDevCommand(): DevCommand | null {
        if (!Command || !this.args.dev) return null;

        return new Command(
            this.name,
            {
                ...this.args.dev,
            },
            { parent: this }
        );
    }

    private createDeployment(): k8s.apps.v1.Deployment {
        // When HPA is enabled, do not set replicas - let HPA manage it
        // This prevents conflicts with VPA recommender and follows K8s best practices
        const replicas = this.args.hpa
            ? undefined
            : this.args.pod.replicas || 1;

        return new k8s.apps.v1.Deployment(
            `${this.name}Deployment`,
            {
                metadata: {
                    name: `${this.name}-${normalizedStageName}`.toLocaleLowerCase(),
                    namespace: this.args.namespace,
                    labels: this.labels,
                },
                spec: {
                    selector: { matchLabels: this.labels },
                    replicas,
                    template: {
                        metadata: { labels: this.labels },
                        spec: {
                            containers: this.args.pod.containers,
                        },
                    },
                },
            },
            { ...this.opts, parent: this }
        );
    }

    private createService(): k8s.core.v1.Service {
        if (!this.deployment) {
            throw new Error("Deployment is required to create a Service");
        }

        if (!this.args.service) {
            throw new Error(
                "Service configuration is required to create a Service"
            );
        }

        return new k8s.core.v1.Service(
            `${this.name}Service`,
            {
                metadata: {
                    name: `${this.name}-${normalizedStageName}-service`.toLocaleLowerCase(),
                    labels: this.labels,
                    namespace: this.args.namespace,
                },
                spec: {
                    type: "ClusterIP",
                    ports: this.args.service.ports,
                    selector: this.labels,
                },
            },
            {
                ...this.opts,
                parent: this,
                dependsOn: this.deployment,
            }
        );
    }

    private createHPA(): k8s.autoscaling.v1.HorizontalPodAutoscaler {
        if (!this.deployment) {
            throw new Error("Deployment is required to create an HPA");
        }
        if (!this.args.hpa) {
            throw new Error("HPA configuration is required to create an HPA");
        }

        return new k8s.autoscaling.v1.HorizontalPodAutoscaler(
            `${this.name}Hpa`,
            {
                metadata: {
                    name: `${this.name}-${normalizedStageName}-hpa`.toLocaleLowerCase(),
                    namespace: this.args.namespace,
                },
                spec: {
                    scaleTargetRef: {
                        apiVersion: "apps/v1",
                        kind: "Deployment",
                        name: this.deployment.metadata.name,
                    },
                    minReplicas: this.args.hpa.min || 1,
                    maxReplicas: this.args.hpa.max,
                    targetCPUUtilizationPercentage:
                        this.args.hpa.cpuUtilization || 80,
                },
            },
            {
                ...this.opts,
                parent: this,
                dependsOn: this.deployment,
            }
        );
    }

    private createIngress(): k8s.networking.v1.Ingress {
        if (!this.args.ingress || !this.service) {
            throw new Error(
                "Ingress configuration and Service are required to create an Ingress"
            );
        }

        const hasPathRoutes =
            this.args.ingress.pathRoutes &&
            this.args.ingress.pathRoutes.length > 0;
        const serviceName = this.service.metadata.name;

        // Mapper for the ingress rules
        const hostToRule = (host: Input<string>) => {
            // Build paths array: main service path + additional path routes
            const paths: Input<inputs.networking.v1.HTTPIngressPath>[] = [
                {
                    path: "/",
                    pathType: "Prefix",
                    backend: {
                        service: {
                            name: serviceName,
                            port: { number: 80 },
                        },
                    },
                },
            ];

            // Add additional path routes if specified
            if (hasPathRoutes) {
                for (const route of this.args.ingress?.pathRoutes ?? []) {
                    paths.push({
                        path: route.path,
                        pathType: route.pathType || "Prefix",
                        backend: {
                            service: {
                                name: route.serviceName,
                                port: { number: route.servicePort },
                            },
                        },
                    });
                }
            }

            return {
                host,
                http: { paths },
            };
        };
        const rules = [
            hostToRule(this.args.ingress.host),
            ...(this.args.ingress.additionalHosts?.map(hostToRule) ?? []),
        ];
        const hosts = [
            this.args.ingress.host,
            ...(this.args.ingress.additionalHosts ?? []),
        ];

        // Build annotations
        const baseAnnotations = {
            "kubernetes.io/ingress.class": "nginx",
            "kubernetes.io/tls-acme": "true",
            "cert-manager.io/cluster-issuer": "letsencrypt",
            "nginx.ingress.kubernetes.io/ssl-redirect": "true",
            "nginx.ingress.kubernetes.io/proxy-buffer-size": "8k",
            "nginx.ingress.kubernetes.io/enable-modsecurity": "false",
        };

        // Add default rewrite-target for backward compatibility
        // (only if no path routes are defined - those override with custom logic)
        const defaultAnnotations: Record<string, string> = hasPathRoutes
            ? {}
            : { "nginx.ingress.kubernetes.io/rewrite-target": "/" };

        return new k8s.networking.v1.Ingress(
            `${this.name}Ingress`,
            {
                metadata: {
                    name: `${this.name}-${normalizedStageName}-ingress`.toLocaleLowerCase(),
                    namespace: this.args.namespace,
                    annotations: {
                        ...baseAnnotations,
                        ...defaultAnnotations,
                        // Merge custom annotations if provided (can override defaults)
                        ...(this.args.ingress?.customAnnotations ?? {}),
                    },
                },
                spec: {
                    ingressClassName: "nginx",
                    rules,
                    tls: [
                        {
                            hosts,
                            secretName: this.args.ingress.tlsSecretName,
                        },
                    ],
                },
            },
            { ...this.opts, parent: this, dependsOn: this.service }
        );
    }

    private createHttpRoute(): k8s.apiextensions.CustomResource {
        if (!this.args.httpRoute || !this.service) {
            throw new Error(
                "HTTPRoute configuration and Service are required to create an HTTPRoute"
            );
        }

        const route = this.args.httpRoute;
        const routeName =
            `${this.name}-${normalizedStageName}-route`.toLocaleLowerCase();
        const servicePort = output(this.args.service?.ports ?? []).apply(
            (ports) => ports[0]?.port ?? 80
        );
        const serviceBackend = {
            name: this.service.metadata.name,
            port: servicePort,
        };
        const rules: HttpRouteRule[] = [
            ...(route.rules ?? []),
            { name: "app", path: "/" },
        ];

        const routeTraffic = { ...edgeTrafficDefaults, ...route.traffic };
        const policies = [
            this.createTrafficPolicy(routeName, undefined, routeTraffic),
            // A rule policy replaces the route one for that rule, so it carries both
            ...rules.flatMap((rule) =>
                rule.traffic
                    ? [
                          this.createTrafficPolicy(routeName, rule.name, {
                              ...routeTraffic,
                              ...rule.traffic,
                          }),
                      ]
                    : []
            ),
        ];

        return new k8s.apiextensions.CustomResource(
            `${this.name}HttpRoute`,
            {
                apiVersion: "gateway.networking.k8s.io/v1",
                kind: "HTTPRoute",
                metadata: {
                    name: routeName,
                    namespace: this.args.namespace,
                    labels: this.labels,
                },
                spec: {
                    parentRefs: route.parentRefs,
                    hostnames: route.hostnames,
                    rules: rules.map((rule) => ({
                        name: rule.name,
                        matches: [
                            {
                                path: {
                                    type: rule.pathType ?? "PathPrefix",
                                    value: rule.path,
                                },
                            },
                        ],
                        backendRefs: [rule.backend ?? serviceBackend],
                    })),
                },
            },
            // Policies first: the route never serves on Envoy's 15s default timeout
            {
                ...this.opts,
                parent: this,
                dependsOn: [this.service, ...policies],
            }
        );
    }

    private createTrafficPolicy(
        routeName: string,
        ruleName: string | undefined,
        traffic: Required<EdgeTraffic>
    ): k8s.apiextensions.CustomResource {
        const suffix = ruleName ? `-${ruleName}` : "";
        return new k8s.apiextensions.CustomResource(
            `${this.name}TrafficPolicy${suffix}`,
            {
                apiVersion: "gateway.envoyproxy.io/v1alpha1",
                kind: "BackendTrafficPolicy",
                metadata: {
                    name: `${routeName}${suffix}`,
                    namespace: this.args.namespace,
                    labels: this.labels,
                },
                spec: {
                    targetRefs: [
                        {
                            group: "gateway.networking.k8s.io",
                            kind: "HTTPRoute",
                            name: routeName,
                            ...(ruleName ? { sectionName: ruleName } : {}),
                        },
                    ],
                    ...trafficPolicySpec(traffic),
                },
            },
            { ...this.opts, parent: this }
        );
    }

    private createServiceMonitor(): k8s.apiextensions.CustomResource {
        if (!this.args.serviceMonitor || !this.service) {
            throw new Error(
                "ServiceMonitor configuration and Service are required to create a ServiceMonitor"
            );
        }

        return new k8s.apiextensions.CustomResource(
            `${this.name}ServiceMonitor`,
            {
                apiVersion: "monitoring.coreos.com/v1",
                kind: "ServiceMonitor",
                metadata: {
                    name: `${this.name}-${normalizedStageName}-service-monitor`.toLocaleLowerCase(),
                    namespace: this.args.namespace,
                    labels: {
                        // Make sure it's discoverable by prometheus with both labels
                        "app.kubernetes.io/name": "prometheus",
                        release: "prometheus",
                        // Keep the app labels consistent with the service
                        ...this.labels,
                        // Add the stage name to the labels
                        environment: normalizedStageName,
                    },
                },
                spec: {
                    selector: {
                        matchLabels: this.labels,
                    },
                    endpoints: [
                        {
                            port: this.args.serviceMonitor.port,
                            path: this.args.serviceMonitor.path,
                            interval:
                                this.args.serviceMonitor.interval || "15s",
                        },
                    ],
                    namespaceSelector: {
                        matchNames: [this.args.namespace],
                    },
                },
            },
            { ...this.opts, parent: this, dependsOn: this.service }
        );
    }
}
