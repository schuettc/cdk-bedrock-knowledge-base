import { App, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { config } from 'dotenv';
import { S3Resources, BedrockKnowledgeBaseResources, LambdaResources } from '.';

config();

export interface BedrockKnowledgeBaseProps extends StackProps {
  logLevel: string;
  namePrefix: string;
}
export class BedrockKnowledgeBase extends Stack {
  constructor(scope: Construct, id: string, props: BedrockKnowledgeBaseProps) {
    super(scope, id, props);

    const namePrefix = props.namePrefix.toLowerCase();
    if (namePrefix.length > 20) {
      throw new Error('Name prefix must be 20 characters or less');
    }

    if (namePrefix.match(/[^a-z0-9-]/)) {
      throw new Error(
        'Name prefix must only contain lowercase letters, numbers, and hyphens',
      );
    }

    const s3Resources = new S3Resources(this, 'S3Resources');
    const bedrockResources = new BedrockKnowledgeBaseResources(
      this,
      'BedrockKnowledgeBaseResources',
      {
        knowledgeBaseBucket: s3Resources.knowledgeBaseBucket,
        namePrefix: namePrefix,
      },
    );

    new LambdaResources(this, 'LambdaResources', {
      logLevel: props.logLevel,
      knowledgeBaseId: bedrockResources.knowledgeBaseId,
      dataSourceId: bedrockResources.dataSourceId,
      knowledgeBaseBucket: s3Resources.knowledgeBaseBucket,
    });

    new CfnOutput(this, 'knowledgeBaseBucket', {
      value: s3Resources.knowledgeBaseBucket.bucketName,
    });

    new CfnOutput(this, 'knowledgeBaseRoleArn', {
      value: bedrockResources.knowledgeBaseRole.roleArn,
    });

    new CfnOutput(this, 'dataSourceId', {
      value: bedrockResources.dataSourceId,
    });

    new CfnOutput(this, 'collectionName', {
      value: bedrockResources.collectionName,
    });

    new CfnOutput(this, 'knowledgeBaseId', {
      value: bedrockResources.knowledgeBaseId,
    });
  }
}

const app = new App();

const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-1',
};

const stackProps = {
  logLevel: process.env.LOG_LEVEL || 'INFO',
  namePrefix: process.env.NAME_PREFIX || 'cdk-bedrock-example',
};

new BedrockKnowledgeBase(app, 'BedrockKnowledgeBase', {
  ...stackProps,
  env: devEnv,
});

app.synth();
