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

export function importVpc(scope: Construct, id: string): ec2.IVpc {
  return ec2.Vpc.fromVpcAttributes(scope, id, {
    vpcId: cdk.Fn.importValue(EXPORT_VPC_ID),
    availabilityZones: cdk.Fn.split(",", cdk.Fn.importValue(EXPORT_VPC_AZS)),
    publicSubnetIds: cdk.Fn.split(",", cdk.Fn.importValue(EXPORT_PUBLIC_SUBNET_IDS)),
    isolatedSubnetIds: cdk.Fn.split(
      ",",
      cdk.Fn.importValue(EXPORT_ISOLATED_SUBNET_IDS),
    ),
  });
}

export function importDbSecret(
  scope: Construct,
  id: string,
): secretsmanager.ISecret {
  return secretsmanager.Secret.fromSecretCompleteArn(
    scope,
    id,
    cdk.Fn.importValue(EXPORT_DB_SECRET_ARN),
  );
}

export function importDbSecurityGroup(
  scope: Construct,
  id: string,
): ec2.ISecurityGroup {
  return ec2.SecurityGroup.fromSecurityGroupId(
    scope,
    id,
    cdk.Fn.importValue(EXPORT_DB_SG_ID),
  );
}
