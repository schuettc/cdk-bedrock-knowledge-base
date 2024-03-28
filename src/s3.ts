import { RemovalPolicy } from 'aws-cdk-lib';
import { Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class S3Resources extends Construct {
  public knowledgeBaseBucket: Bucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.knowledgeBaseBucket = new Bucket(this, 'knowledgeBaseBucket', {
      publicReadAccess: false,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: BucketEncryption.S3_MANAGED,
      eventBridgeEnabled: true,
    });
  }
}
