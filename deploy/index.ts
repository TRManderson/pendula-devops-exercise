import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as kx from "@pulumi/kubernetesx";


const config = new pulumi.Config();
const deploymentNamespace = config.get("namespace") || "app";
const appName = config.get("app") || "app";
const replicaCount = config.requireNumber("replicas", {min: 1});

const namespace = new k8s.core.v1.Namespace(deploymentNamespace);

const appLabels = { app: appName };
const deployment = new k8s.apps.v1.Deployment(appName, {
    metadata: {
        namespace: namespace.id,
        name: appName,
        labels: appLabels,
    },
    spec: {
        selector: { matchLabels: appLabels },
        replicas: replicaCount,
        template: {
            metadata: { labels: appLabels },
            spec: { containers: [{ name: "nginx", image: "nginx" }] }
        }
    }
});
export const name = deployment.metadata.name;
