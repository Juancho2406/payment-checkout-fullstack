import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecrassets from "aws-cdk-lib/aws-ecr-assets";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";

export const PSP_SECRET_NAME = "checkout/psp";

export type ApiStackProps = cdk.StackProps & {
  readonly vpc: ec2.IVpc;
  readonly dbSecret: secretsmanager.ISecret;
  readonly dbSecurityGroup: ec2.SecurityGroup;
};

/**
 * Hexagonal Nest API on ECS Fargate behind an ALB (HTTP).
 * The listener is not public: only CloudFront origin-facing IPs.
 * HTTPS is terminated at CloudFront in WebStack (`/api/*` → this ALB).
 * Not Lambda.
 */
export class ApiStack extends cdk.Stack {
  readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  readonly loadBalancerDnsName: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const repoRoot = path.join(__dirname, "..", "..", "..");
    const pspSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "PspSecret",
      PSP_SECRET_NAME,
    );

    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc: props.vpc,
      containerInsightsV2: ecs.ContainerInsights.DISABLED,
    });

    const logGroup = new logs.LogGroup(this, "ApiLogs", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const service = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      "Service",
      {
        cluster,
        cpu: 256,
        memoryLimitMiB: 512,
        desiredCount: 1,
        publicLoadBalancer: true,
        assignPublicIp: true,
        taskSubnets: { subnetType: ec2.SubnetType.PUBLIC },
        listenerPort: 80,
        protocol: elbv2.ApplicationProtocol.HTTP,
        healthCheckGracePeriod: cdk.Duration.minutes(5),
        idleTimeout: cdk.Duration.seconds(120),
        minHealthyPercent: 0,
        maxHealthyPercent: 200,
        openListener: false,
        circuitBreaker: { enable: true, rollback: true },
        runtimePlatform: {
          cpuArchitecture: ecs.CpuArchitecture.X86_64,
          operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        },
        taskImageOptions: {
          image: ecs.ContainerImage.fromAsset(repoRoot, {
            file: "apps/api/Dockerfile",
            platform: ecrassets.Platform.LINUX_AMD64,
          }),
          containerPort: 3001,
          logDriver: ecs.LogDrivers.awsLogs({
            streamPrefix: "api",
            logGroup,
          }),
          environment: {
            NODE_ENV: "production",
            PORT: "3001",
          },
          secrets: {
            DB_USER: ecs.Secret.fromSecretsManager(props.dbSecret, "username"),
            DB_PASSWORD: ecs.Secret.fromSecretsManager(props.dbSecret, "password"),
            DB_HOST: ecs.Secret.fromSecretsManager(props.dbSecret, "host"),
            DB_PORT: ecs.Secret.fromSecretsManager(props.dbSecret, "port"),
            DB_NAME: ecs.Secret.fromSecretsManager(props.dbSecret, "dbname"),
            PSP_BASE_URL: ecs.Secret.fromSecretsManager(pspSecret, "PSP_BASE_URL"),
            PSP_PRIVATE_KEY: ecs.Secret.fromSecretsManager(
              pspSecret,
              "PSP_PRIVATE_KEY",
            ),
            PSP_INTEGRITY_SECRET: ecs.Secret.fromSecretsManager(
              pspSecret,
              "PSP_INTEGRITY_SECRET",
            ),
          },
        },
      },
    );

    service.targetGroup.configureHealthCheck({
      path: "/api/v1/health",
      healthyHttpCodes: "200",
      interval: cdk.Duration.seconds(30),
      timeout: cdk.Duration.seconds(5),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 5,
    });

    const cloudFrontOriginFacing = ec2.PrefixList.fromLookup(
      this,
      "CloudFrontOriginFacing",
      { prefixListName: "com.amazonaws.global.cloudfront.origin-facing" },
    );
    service.loadBalancer.connections.allowFrom(
      cloudFrontOriginFacing,
      ec2.Port.tcp(80),
      "CloudFront to ALB",
    );

    service.service.connections.allowTo(
      props.dbSecurityGroup,
      ec2.Port.tcp(5432),
      "Fargate Nest API to PostgreSQL",
    );

    this.loadBalancer = service.loadBalancer;
    this.loadBalancerDnsName = service.loadBalancer.loadBalancerDnsName;

    new cdk.CfnOutput(this, "ApiAlbDns", {
      value: this.loadBalancerDnsName,
    });
    new cdk.CfnOutput(this, "ApiTargetGroupArn", {
      value: service.targetGroup.targetGroupArn,
    });
  }
}
