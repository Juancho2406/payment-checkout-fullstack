import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import type { Construct } from "constructs";

export type WebStackProps = cdk.StackProps & {
  readonly apiOriginHostname: string;
};

/**
 * React SPA on S3, HTTPS via CloudFront (default certificate).
 * `/api/*` and `/docs*` are proxied to the API ALB over HTTP so the
 * browser talks to a single HTTPS origin (`VITE_API_BASE_URL=/api/v1`).
 */
export class WebStack extends cdk.Stack {
  readonly spaUrl: string;

  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    const repoRoot = path.join(__dirname, "..", "..", "..");

    const bucket = new s3.Bucket(this, "Spa", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const apiOrigin = new origins.HttpOrigin(props.apiOriginHostname, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      httpPort: 80,
      readTimeout: cdk.Duration.seconds(60),
      keepaliveTimeout: cdk.Duration.seconds(60),
    });

    const spaHeaders = new cloudfront.ResponseHeadersPolicy(this, "SpaHeaders", {
      securityHeadersBehavior: {
        strictTransportSecurity: {
          accessControlMaxAge: cdk.Duration.days(180),
          includeSubdomains: true,
          override: true,
        },
        contentTypeOptions: { override: true },
        frameOptions: {
          frameOption: cloudfront.HeadersFrameOption.DENY,
          override: true,
        },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.NO_REFERRER,
          override: true,
        },
        contentSecurityPolicy: {
          override: true,
          contentSecurityPolicy:
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'",
        },
      },
    });

    const apiBehavior: cloudfront.BehaviorOptions = {
      origin: apiOrigin,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy:
        cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
    };

    const distribution = new cloudfront.Distribution(this, "Cdn", {
      comment: "payment-checkout SPA + API",
      defaultRootObject: "index.html",
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        responseHeadersPolicy: spaHeaders,
      },
      additionalBehaviors: {
        "/api/*": apiBehavior,
        "/docs": apiBehavior,
        "/docs/*": apiBehavior,
        "/docs-json": apiBehavior,
      },
    });

    new s3deploy.BucketDeployment(this, "DeploySpa", {
      sources: [s3deploy.Source.asset(path.join(repoRoot, "apps/web/dist"))],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ["/*"],
      memoryLimit: 512,
    });

    this.spaUrl = `https://${distribution.distributionDomainName}`;

    new cdk.CfnOutput(this, "SpaUrl", { value: this.spaUrl });
    new cdk.CfnOutput(this, "DistributionId", {
      value: distribution.distributionId,
    });
  }
}
