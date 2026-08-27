/**
 * React SPA static assets on S3, HTTPS via CloudFront.
 * Diagram: svc-cloudfront, svc-s3 (apps/web).
 */
export class WebStack {
  // TODO: s3.Bucket (OAC) + cloudfront.Distribution
  // TODO: SPA origin + API custom domain / CORS to the ALB
}
