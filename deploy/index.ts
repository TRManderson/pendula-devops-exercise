import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

import * as config from "./shared";
import * as db from "./db"

const labels = { app: config.appName };

const secret = new k8s.core.v1.Secret("app-config", {
    metadata: {
        labels: labels,
        namespace: config.namespace,
    },
    stringData: {
        DB_URL: pulumi.interpolate`postgresql://${config.postgresUser}:${config.postgresPassword}@${db.service}.${config.namespace}.svc.cluster.local:5432/${config.dbName}`,
    },
});


const deployment = new k8s.apps.v1.Deployment(config.appName, {
    metadata: {
        namespace: config.namespace,
        labels: labels,
    },
    spec: {
        selector: { matchLabels: labels },
        replicas: config.replicaCount,
        template: {
            metadata: { labels: labels },
            spec: { containers: [{
                name: "app",
                image: "ghcr.io/trmanderson/pendula-devops-exercise:" + config.containerVersion,
                // Allows rollout restart to serve as "update"
                imagePullPolicy: "Always",
                envFrom: [{
                    secretRef: {name: secret.metadata.name},
                }],
                command: ["yarn", "start"],
                env: [{
                    name: "PORT",
                    value: config.appPort.toString(),
                }],
                ports: [{
                    name: "http",
                    containerPort: config.appPort
                }]
            }] }
        }
    }
});

const appService = new k8s.core.v1.Service(config.appName, {
    metadata: {
        namespace: config.namespace,
        labels: labels
    },
    spec: {
        selector: labels,
        ports: [{
            name: "http",
            protocol: "TCP",
            port: config.appPort,
            targetPort: config.appPort,
        }],
        type: "LoadBalancer",
    },
})

export const name = deployment.metadata.name;
export const service = appService.metadata.name;
