import * as k8s from "@pulumi/kubernetes";
import type * as inputs from "@pulumi/kubernetes/types/input";
import {
    ComponentResource,
    type ComponentResourceOptions,
    type Input,
    type Output,
} from "@pulumi/pulumi";
import { normalizedStageName } from "../utils";

/**
 * Arguments used to create a Kubernetes Job
 */
export type KubernetesJobArgs = {
    // Namespace where the job should be deployed
    namespace: Input<string>;

    // The app labels
    appLabels: Record<string, string>;

    // Job specific configuration
    job: {
        // Container configuration
        container: Input<inputs.core.v1.Container>;

        // Optional job configuration
        backoffLimit?: Input<number>; // Default to 3
        completions?: Input<number>; // Default to 1
        parallelism?: Input<number>; // Default to 1
        ttlSecondsAfterFinished?: Input<number>; // Default to 100
        activeDeadlineSeconds?: Input<number>; // Optional timeout
    };
};

/**
 * A Kubernetes Job that can be used for running one-off tasks
 */
export class KubernetesJob extends ComponentResource {
    // Resources
    public readonly job: k8s.batch.v1.Job;

    // Additional outputs
    public readonly jobName: Output<string>;
    public readonly succeeded: Output<boolean>;

    constructor(
        private name: string,
        private args: KubernetesJobArgs,
        private opts?: ComponentResourceOptions
    ) {
        super("k8s:frak:KubernetesJob", name, args, opts);

        // Create the job
        this.job = this.createJob();
        this.jobName = this.job.metadata.name;

        // Track job completion status
        this.succeeded = this.job.status.succeeded.apply(
            (succeeded) => succeeded > 0
        );

        this.registerOutputs({
            jobName: this.jobName,
            succeeded: this.succeeded,
        });
    }

    private createJob(): k8s.batch.v1.Job {
        return new k8s.batch.v1.Job(
            `${this.name}Job`,
            {
                metadata: {
                    name: `${this.name}-job`.toLowerCase(),
                    namespace: this.args.namespace,
                    labels: this.args.appLabels,
                },
                spec: {
                    backoffLimit: this.args.job.backoffLimit ?? 3,
                    completions: this.args.job.completions ?? 1,
                    parallelism: this.args.job.parallelism ?? 1,
                    ttlSecondsAfterFinished:
                        this.args.job.ttlSecondsAfterFinished ?? 100,
                    activeDeadlineSeconds: this.args.job.activeDeadlineSeconds,
                    template: {
                        metadata: {
                            labels: this.args.appLabels,
                        },
                        spec: {
                            restartPolicy: "OnFailure",
                            containers: [this.args.job.container],
                            // We are always deploying on arm64
                            nodeSelector: {
                                "kubernetes.io/arch": "arm64",
                                // "cloud.google.com/gke-nodepool": "application",
                            },
                            tolerations: [
                                {
                                    key: "dedicated",
                                    value: `app-${normalizedStageName}`,
                                    effect: "NoSchedule",
                                },
                            ],
                        },
                    },
                },
            },
            { ...this.opts, parent: this }
        );
    }
}
