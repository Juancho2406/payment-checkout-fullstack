import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";
import { EXPORT_DB_SECRET_ARN, EXPORT_DB_SG_ID } from "./imported-platform";

export type DbStackProps = cdk.StackProps & {
  readonly vpc: ec2.IVpc;
};

/**
 * RDS PostgreSQL in isolated subnets. Credentials land in Secrets Manager
 * (JSON: username, password, host, port, dbname). The API task reads them.
 */
export class DbStack extends cdk.Stack {
  readonly instance: rds.DatabaseInstance;
  readonly secret: secretsmanager.ISecret;
  readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: DbStackProps) {
    super(scope, id, props);

    this.securityGroup = new ec2.SecurityGroup(this, "DbSg", {
      vpc: props.vpc,
      description: "PostgreSQL from Fargate only",
      allowAllOutbound: true,
    });

    this.instance = new rds.DatabaseInstance(this, "Postgres", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_13,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.MICRO,
      ),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [this.securityGroup],
      credentials: rds.Credentials.fromGeneratedSecret("checkout"),
      databaseName: "checkout",
      allocatedStorage: 20,
      multiAz: false,
      publiclyAccessible: false,
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      backupRetention: cdk.Duration.days(0),
      storageEncrypted: true,
      deleteAutomatedBackups: true,
    });

    const secret = this.instance.secret;
    if (!secret) {
      throw new Error("RDS did not create a credentials secret");
    }
    this.secret = secret;

    new cdk.CfnOutput(this, "DbSecretArn", {
      value: this.secret.secretArn,
      exportName: EXPORT_DB_SECRET_ARN,
    });
    new cdk.CfnOutput(this, "DbSecurityGroupId", {
      value: this.securityGroup.securityGroupId,
      exportName: EXPORT_DB_SG_ID,
    });
  }
}
