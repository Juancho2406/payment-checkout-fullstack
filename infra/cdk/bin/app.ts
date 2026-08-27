/**
 * Proposed deploy graph (see docs/architecture.drawio).
 *
 *   NetworkStack (VPC)
 *     -> DbStack (RDS Postgres in private subnet)
 *     -> ApiStack (ECS Fargate + ALB; same hexagonal Nest API)
 *   WebStack (S3 + CloudFront) — outside the VPC
 *
 * Local equivalent: ../docker-compose.yml (Postgres only).
 * Constructs are filled when the API has an image to run.
 */
import { NetworkStack } from "../lib/network-stack";
import { DbStack } from "../lib/db-stack";
import { ApiStack } from "../lib/api-stack";
import { WebStack } from "../lib/web-stack";

export const proposedStacks = {
  network: NetworkStack,
  db: DbStack,
  api: ApiStack,
  web: WebStack,
};
