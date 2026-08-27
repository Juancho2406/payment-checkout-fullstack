/**
 * RDS PostgreSQL in the private subnet. Credentials in Secrets Manager.
 * Diagram: svc-rds, svc-secrets. Local stand-in: docker-compose.yml.
 */
export class DbStack {
  // TODO: aws-rds.DatabaseInstance (postgres), not publicly accessible
  // TODO: secret in Secrets Manager (PSP keys live there too on deploy)
}
