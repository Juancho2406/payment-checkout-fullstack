/**
 * VPC with a public subnet (ALB) and a private subnet (Fargate, RDS).
 * Diagram: aws-cloud → vpc-1 → public-subnet / private-subnet.
 */
export class NetworkStack {
  // TODO: aws-ec2.Vpc, public + private subnets, no NAT unless required for PSP egress
}
