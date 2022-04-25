import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

const config = new pulumi.Config();

// Application name (used in tags and app deployment and service)
export const appName = config.get("app") || "app";
// Replica count for application deployment
export const replicaCount = config.requireNumber("replicas", {min: 1});
// Docker image tag for application container
export const containerVersion = config.get("containerVersion") || "latest";
// App port to run on (exposed via container AND via service)
export const appPort = config.getNumber("port") || 8080;

// PostgreSQL config
export const postgresUser = config.requireSecret("postgresUser");
export const postgresPassword = config.requireSecret("postgresUser");
export const dbName = config.get("dbName") || "db";

// Unique part of app namespace for resource
const namespacePrefix = config.get("namespacePrefix") || "app";
const deployNamespace = new k8s.core.v1.Namespace(namespacePrefix);


export const namespace = deployNamespace.metadata.name;