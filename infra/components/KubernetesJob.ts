import * as k8s from "@pulumi/kubernetes";
import type * as inputs from "@pulumi/kubernetes/types/input";
import {
    ComponentResource,
    type ComponentResourceOptions,
    type Input,
} from "@pulumi/pulumi";

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
    };
};

/**
 * A Kubernetes Job that can be used for running one-off tasks
 */
export class KubernetesJob extends ComponentResource {
    // Resources
    public readonly job: k8s.batch.v1.Job;

    constructor(
        private name: string,
        private args: KubernetesJobArgs,
        private opts?: ComponentResourceOptions
    ) {
        super("k8s:frak:KubernetesJob", name, args, opts);

        // Create the job
        this.job = this.createJob();

        this.registerOutputs({
            jobName: this.job.metadata.name,
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
                    backoffLimit: 3,
                    completions: 1,
                    parallelism: 1,
                    ttlSecondsAfterFinished: 100,
                    template: {
                        metadata: {
                            labels: this.args.appLabels,
                        },
                        spec: {
                            restartPolicy: "OnFailure",
                            containers: [this.args.job.container],
                        },
                    },
                },
            },
            { ...this.opts, parent: this }
        );
    }
}
