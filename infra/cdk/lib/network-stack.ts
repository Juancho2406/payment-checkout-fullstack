import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import type { Construct } from "constructs";
import {
  EXPORT_ISOLATED_SUBNET_IDS,
  EXPORT_PUBLIC_SUBNET_IDS,
  EXPORT_VPC_AZS,
  EXPORT_VPC_ID,
} from "./imported-platform";

/**
 * VPC with public subnets (ALB + Fargate with a public IP) and isolated
 * subnets (RDS). No NAT gateway: Fargate reaches ECR and the PSP sandbox
 * via the internet gateway; RDS has no inbound path from the internet.
 */
export class NetworkStack extends cdk.Stack {
  readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: "isolated",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    new cdk.CfnOutput(this, "VpcId", {
      value: this.vpc.vpcId,
      exportName: EXPORT_VPC_ID,
    });
    new cdk.CfnOutput(this, "VpcAzs", {
      value: cdk.Fn.join(",", this.vpc.availabilityZones),
      exportName: EXPORT_VPC_AZS,
    });
    new cdk.CfnOutput(this, "PublicSubnetIds", {
      value: cdk.Fn.join(
        ",",
        this.vpc.publicSubnets.map((subnet) => subnet.subnetId),
      ),
      exportName: EXPORT_PUBLIC_SUBNET_IDS,
    });
    new cdk.CfnOutput(this, "IsolatedSubnetIds", {
      value: cdk.Fn.join(
        ",",
        this.vpc.isolatedSubnets.map((subnet) => subnet.subnetId),
      ),
      exportName: EXPORT_ISOLATED_SUBNET_IDS,
    });
  }
}
