import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

import * as config from "./shared";

const labels = {"app": "postgres"};

const secret = new k8s.core.v1.Secret("pg-config", {
    metadata: {
        namespace: config.namespace,
        labels: labels,
    },
    stringData: {
        POSTGRES_USER: config.postgresUser,
        POSTGRES_PASSWORD: config.postgresPassword,
        POSTGRES_DB: config.dbName,
    }
});


const pvc = new k8s.core.v1.PersistentVolumeClaim("postgres", {
    metadata: {
        namespace: config.namespace,
        labels: labels,
    },
    spec: {
        accessModes: ["ReadWriteOnce"],
        resources: {requests: {storage: "3Gi"}},
    }
})

const deployment = new k8s.apps.v1.Deployment("postgres", {
    metadata: {
        namespace: config.namespace,
        labels: labels,
    },
    spec: {
        selector: { matchLabels: labels },
        // using ReadWriteOnce host path for PVC, so can only have one replica
        replicas: 1, 
        template: {
            metadata: { labels: labels },
            spec: {
                containers: [{
                    name: "postgres",
                    image: "postgres:14-alpine",
                    volumeMounts: [{
                        name: "postgres-pvc",
                        mountPath: "/data"
                    }],
                    envFrom: [{
                        secretRef: {name: secret.metadata.name},
                    }],
                    ports: [{
                        name: "db",
                        containerPort: 5432,
                    }]
                }],
                volumes: [{
                    name: "postgres-pvc",
                    persistentVolumeClaim: {
                        claimName: pvc.metadata.name,
                    }
                }]
            }
        }
    }
});
const dbService = new k8s.core.v1.Service("postgres", {
    metadata: {
        namespace: config.namespace,
        labels: labels
    },
    spec: {
        selector: labels,
        ports: [{
            name: "db",
            port: 5432,
            targetPort: 5432
        }],
        // single instance so may as well use ClusterIP
        type: "ClusterIP"
    }
})


export const service = dbService.metadata.name;