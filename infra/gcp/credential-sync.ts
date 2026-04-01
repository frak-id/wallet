import { normalizedStageName } from "../utils";
import { credentialSyncImage } from "./images";
import { walletNamespace } from "./utils";

const appLabels = { app: "credential-sync" };

const sqldUrl = `http://sqld-production-service.db-production.svc.cluster.local:8080`;

const credentialSyncSecrets = new kubernetes.core.v1.Secret(
    "credential-sync-secrets",
    {
        metadata: {
            name: `credential-sync-secrets-${normalizedStageName}`,
            namespace: walletNamespace.metadata.name,
        },
        type: "Opaque",
        stringData: {
            MONGODB_NEXUS_URI: new sst.Secret("MONGODB_NEXUS_URI").value,
            LIBSQL_URL: sqldUrl,
        },
    }
);

new kubernetes.batch.v1.CronJob("credential-sync-cronjob", {
    metadata: {
        name: `credential-sync-${normalizedStageName}`,
        namespace: walletNamespace.metadata.name,
        labels: appLabels,
    },
    spec: {
        schedule: "0 */6 * * *",
        concurrencyPolicy: "Forbid",
        successfulJobsHistoryLimit: 3,
        failedJobsHistoryLimit: 3,
        jobTemplate: {
            spec: {
                backoffLimit: 2,
                ttlSecondsAfterFinished: 3600,
                activeDeadlineSeconds: 600,
                template: {
                    metadata: { labels: appLabels },
                    spec: {
                        restartPolicy: "OnFailure",
                        containers: [
                            {
                                name: "credential-sync",
                                image: credentialSyncImage.ref,
                                envFrom: [
                                    {
                                        secretRef: {
                                            name: credentialSyncSecrets.metadata
                                                .name,
                                        },
                                    },
                                ],
                                resources: {
                                    requests: {
                                        cpu: "50m",
                                        memory: "128Mi",
                                    },
                                    limits: {
                                        cpu: "200m",
                                        memory: "256Mi",
                                    },
                                },
                            },
                        ],
                    },
                },
            },
        },
    },
});
