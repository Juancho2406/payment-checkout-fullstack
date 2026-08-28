/**
 * Deploy graph (see docs/architecture.drawio):
 *
 *   CheckoutNetwork (VPC)
 *     -> CheckoutDb (RDS Postgres in isolated subnet)
 *     -> CheckoutApi (ECS Fargate + ALB; same hexagonal Nest API)
 *   CheckoutWeb (S3 + CloudFront) — HTTPS edge in front of SPA and `/api/*`
 *
 * `cdk deploy -c target=platform|api|web|all` synthesizes only that slice so
 * a web push does not rebuild the API image and an API push does not upload the SPA.
 *
 * Isolated API/web deploys pass concrete IDs via context (`vpcId`, `dbSecretArn`,
 * `dbSgId`, `apiOriginHostname`) instead of CloudFormation ImportValue, so
 * updating one stack cannot delete an export the other still uses.
 *
 * Local equivalent: ../docker-compose.yml (Postgres only).
 */
import * as cdk from "aws-cdk-lib";
import { ApiStack } from "../lib/api-stack";
import { DbStack } from "../lib/db-stack";
import { readDeployTarget, requiredContext } from "../lib/imported-platform";
import { NetworkStack } from "../lib/network-stack";
import { WebStack } from "../lib/web-stack";

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const target = readDeployTarget(app);

if (target === "platform" || target === "all") {
  const network = new NetworkStack(app, "CheckoutNetwork", { env });
  const db = new DbStack(app, "CheckoutDb", { env, vpc: network.vpc });
  if (target === "all") {
    const api = new ApiStack(app, "CheckoutApi", {
      env,
      vpc: network.vpc,
      dbSecret: db.secret,
      dbSecurityGroup: db.securityGroup,
    });
    new WebStack(app, "CheckoutWeb", {
      env,
      apiOriginHostname: api.loadBalancer.loadBalancerDnsName,
    });
  }
}

if (target === "api") {
  new ApiStack(app, "CheckoutApi", { env });
}

if (target === "web") {
  new WebStack(app, "CheckoutWeb", {
    env,
    apiOriginHostname: requiredContext(app, "apiOriginHostname"),
  });
}

cdk.Tags.of(app).add("project", "payment-checkout-fullstack");

export const proposedStacks = {
  network: NetworkStack,
  db: DbStack,
  api: ApiStack,
  web: WebStack,
};
