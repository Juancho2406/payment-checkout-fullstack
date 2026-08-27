/**
 * Deploy graph (see docs/architecture.drawio):
 *
 *   CheckoutNetwork (VPC)
 *     -> CheckoutDb (RDS Postgres in isolated subnet)
 *     -> CheckoutApi (ECS Fargate + ALB; same hexagonal Nest API)
 *   CheckoutWeb (S3 + CloudFront) — HTTPS edge in front of SPA and `/api/*`
 *
 * Local equivalent: ../docker-compose.yml (Postgres only).
 */
import * as cdk from "aws-cdk-lib";
import { ApiStack } from "../lib/api-stack";
import { DbStack } from "../lib/db-stack";
import { NetworkStack } from "../lib/network-stack";
import { WebStack } from "../lib/web-stack";

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const network = new NetworkStack(app, "CheckoutNetwork", { env });
const db = new DbStack(app, "CheckoutDb", { env, vpc: network.vpc });
const api = new ApiStack(app, "CheckoutApi", {
  env,
  vpc: network.vpc,
  dbSecret: db.secret,
  dbSecurityGroup: db.securityGroup,
});
new WebStack(app, "CheckoutWeb", {
  env,
  loadBalancer: api.loadBalancer,
});

cdk.Tags.of(app).add("project", "payment-checkout-fullstack");

export const proposedStacks = {
  network: NetworkStack,
  db: DbStack,
  api: ApiStack,
  web: WebStack,
};
