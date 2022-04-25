import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as kx from "@pulumi/kubernetesx";


const config = new pulumi.Config();
const deploymentNamespace = config.get("namespace") || "app";
const appName = config.get("app") || "app";
const replicaCount = config.requireNumber("replicas", {min: 1});
const containerVersion = config.get("containerVersion") || "latest";

const postgresUser = config.requireSecret("postgresUser");
const postgresPassword = config.requireSecret("postgresUser");
const dbName = config.get("dbName") || "db";


const pgLabels = {"app": "postgres"};
const appLabels = { app: appName };

const namespace = new k8s.core.v1.Namespace(deploymentNamespace);

const pgSecret = new k8s.core.v1.Secret("pg-config", {
    metadata: {
        namespace: namespace.metadata.name,
        labels: pgLabels,
    },
    stringData: {
        POSTGRES_USER: postgresUser,
        POSTGRES_PASSWORD: postgresPassword,
        POSTGRES_DB: dbName,
    }
});



const postgresVolume = new k8s.core.v1.PersistentVolumeClaim("postgres", {
    metadata: {
        namespace: namespace.metadata.name,
        labels: pgLabels,
    },
    spec: {
        accessModes: ["ReadWriteOnce"],
        resources: {requests: {storage: "3Gi"}},
    }
})
const postgresDeploy = new k8s.apps.v1.Deployment("postgres", {
    metadata: {
        namespace: namespace.metadata.name,
        labels: pgLabels,
    },
    spec: {
        selector: { matchLabels: pgLabels },
        // using ReadWriteOnce host path for PVC, so can only have one replica
        replicas: 1, 
        template: {
            metadata: { labels: pgLabels },
            spec: {
                containers: [{
                    name: "postgres",
                    image: "postgres:14-alpine",
                    volumeMounts: [{
                        name: "postgres-pvc",
                        mountPath: "/data"
                    }],
                    envFrom: [{
                        secretRef: {name: pgSecret.metadata.name},
                    }],
                    ports: [{
                        name: "db",
                        containerPort: 5432,
                    }]
                }],
                volumes: [{
                    name: "postgres-pvc",
                    persistentVolumeClaim: {
                        claimName: postgresVolume.metadata.name,
                    }
                }]
            }
        }
    }
});
const postgresService = new k8s.core.v1.Service("postgres", {
    metadata: {
        namespace: namespace.metadata.name,
        labels: pgLabels
    },
    spec: {
        selector: pgLabels,
        ports: [{
            name: "db",
            port: 5432,
            targetPort: 5432
        }]
    }
})


const appSecret = new k8s.core.v1.Secret("app-config", {
    metadata: {
        labels: appLabels,
        namespace: namespace.metadata.name,
    },
    stringData: {
        DB_URL: pulumi.interpolate`postgresql://${postgresUser}:${postgresPassword}@${postgresService.metadata.name}.${namespace.metadata.name}.svc.cluster.local:5432/postgres`,
    },
});


const deployment = new k8s.apps.v1.Deployment(appName, {
    metadata: {
        namespace: namespace.metadata.name,
        labels: appLabels,
    },
    spec: {
        selector: { matchLabels: appLabels },
        replicas: replicaCount,
        template: {
            metadata: { labels: appLabels },
            spec: { containers: [{
                name: "app",
                image: "ghcr.io/trmanderson/pendula-devops-exercise:" + containerVersion,
                imagePullPolicy: "Always",
                envFrom: [{
                    secretRef: {name: appSecret.metadata.name},
                }],
                command: ["yarn", "start"],
                env: [{
                    name: "PORT",
                    value: "8080",
                }],
                ports: [{
                    name: "http",
                    containerPort: 8080
                }]
            }] }
        }
    }
});
export const name = deployment.metadata.name;
