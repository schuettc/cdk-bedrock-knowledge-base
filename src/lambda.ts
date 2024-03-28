import { Duration } from 'aws-cdk-lib';
import {
  ManagedPolicy,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Bucket, EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { Construct } from 'constructs';

interface RecordingLambdaResourcesProps {
  logLevel: string;
  dataSourceId: string;
  knowledgeBaseId: string;
  knowledgeBaseBucket: Bucket;
}

export class LambdaResources extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: RecordingLambdaResourcesProps,
  ) {
    super(scope, id);

    const dataSyncLambdaRole = new Role(this, 'dataSyncLambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        ['bedrockPolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: ['*'],
              actions: ['bedrock:*'],
            }),
          ],
        }),
      },
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    const dataSyncLambda = new NodejsFunction(this, 'dataSyncLambda', {
      entry: './src/resources/dataSync/index.ts',
      runtime: Runtime.NODEJS_LATEST,
      architecture: Architecture.ARM_64,
      handler: 'handler',
      timeout: Duration.minutes(5),
      role: dataSyncLambdaRole,
      environment: {
        KNOWLEDGE_BASE_ID: props.knowledgeBaseId,
        DATA_SOURCE_ID: props.dataSourceId,
        LOG_LEVEL: props.logLevel,
      },
    });

    props.knowledgeBaseBucket.grantRead(dataSyncLambda);

    props.knowledgeBaseBucket.addEventNotification(
      EventType.OBJECT_CREATED,
      new LambdaDestination(dataSyncLambda),
      { prefix: 'knowledgeBase' },
    );
  }
}
