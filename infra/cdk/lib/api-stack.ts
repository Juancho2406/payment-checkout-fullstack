/**
 * NestJS hexagonal API on ECS Fargate behind an Application Load Balancer.
 * Diagram: svc-alb, svc-fargate. Not Lambda (explicit kata decision).
 */
export class ApiStack {
  // TODO: ecs.FargateService + elbv2.ApplicationLoadBalancer
  // TODO: task env from Secrets Manager; outbound to PSP sandbox
}
