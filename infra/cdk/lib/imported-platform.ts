import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";

export const EXPORT_VPC_ID = "CheckoutVpcId";
export const EXPORT_VPC_AZS = "CheckoutVpcAzs";
export const EXPORT_PUBLIC_SUBNET_IDS = "CheckoutPublicSubnetIds";
export const EXPORT_ISOLATED_SUBNET_IDS = "CheckoutIsolatedSubnetIds";
export const EXPORT_DB_SECRET_ARN = "CheckoutDbSecretArn";
export const EXPORT_DB_SG_ID = "CheckoutDbSgId";
export const EXPORT_API_ALB_DNS = "CheckoutApiAlbDns";

export type DeployTarget = "platform" | "api" | "web" | "all";

export function readDeployTarget(app: cdk.App): DeployTarget {
  const raw = app.node.tryGetContext("target");
  if (raw === "platform" || raw === "api" || raw === "web" || raw === "all") {
    return raw;
  }
  return "all";
}

export function requiredContext(scope: Construct, key: string): string {
  const value = scope.node.tryGetContext(key);
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(
      `CDK context -c ${key}=... is required (resolve live platform IDs before deploy)`,
    );
  }
  return value.trim();
}

/** Concrete vpcId from `-c vpcId=` so Fargate can select public subnets at synth. */
export function importVpc(scope: Construct, id: string): ec2.IVpc {
  return ec2.Vpc.fromLookup(scope, id, {
    vpcId: requiredContext(scope, "vpcId"),
  });
}

export function importDbSecret(
  scope: Construct,
  id: string,
): secretsmanager.ISecret {
  return secretsmanager.Secret.fromSecretCompleteArn(
    scope,
    id,
    requiredContext(scope, "dbSecretArn"),
  );
}

export function importDbSecurityGroup(
  scope: Construct,
  id: string,
): ec2.ISecurityGroup {
  return ec2.SecurityGroup.fromSecurityGroupId(
    scope,
    id,
    requiredContext(scope, "dbSgId"),
  );
}
