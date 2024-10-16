# CDK Deployed Knowledge Base for Amazon Bedrock

In this demo, we'll see how to deploy a [Knowledge Base for Amazon Bedrock](https://aws.amazon.com/bedrock/knowledge-bases/) with [Amazon OpenSearch](https://aws.amazon.com/opensearch-service/) as the vector store using CDK. Deploying a Knowledge Base requires severals steps that will be accomplished using a [Custom Resource](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.CustomResource.html). This Custom Resource will build resources following this basic guide: https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base-create.html

1. Create Bucket
2. Create Vector Index
   1. Create Access Policy
   2. Create Network Security Policy
   3. Create Encryption Policy
   4. Create Collection
   5. Create Index
3. Create Knowledge Base
4. Create Data Source

This demo also includes a Lambda function that will [`StartIngestionJob`](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent_StartIngestionJob.html) when a new object is created in the Bucket to automatically sync the Data Source with the Knowledge Base.

## Custom Resource Configuration

Due to the complex nature of Knowledge Bases, many fields are statically defined in this demo that can and should be customized.

### Names

This CDK deployment uses two names for configuring the resources used - a `namePrefix` and `nameSuffix`. The `namePrefix` can be defined in a `.env` file:

```bash
NAME_PREFIX='sample-name'
```

The `nameSuffix` will be generated during deployment and used throughout. The result is that most resources will be named: `namePrefix-nameSuffix`.

### Access Policy

```typescript
const parsedArns: string[] = JSON.parse(accessPolicyArns);
const principalArray = [
  ...parsedArns,
  knowledgeBaseRoleArn,
  knowledgeBaseCustomResourceRole,
];

const policy = [
  {
    Rules: [
      {
        Resource: [`collection/${namePrefix}-${nameSuffix}`],
        Permission: [
          'aoss:DescribeCollectionItems',
          'aoss:CreateCollectionItems',
          'aoss:UpdateCollectionItems',
        ],
        ResourceType: 'collection',
      },
      {
        Resource: [`index/${namePrefix}-${nameSuffix}/*`],
        Permission: [
          'aoss:UpdateIndex',
          'aoss:DescribeIndex',
          'aoss:ReadDocument',
          'aoss:WriteDocument',
          'aoss:CreateIndex',
        ],
        ResourceType: 'index',
      },
    ],
    Principal: principalArray,
    Description: '',
  },
];
```

For example, this Access Policy will be applied to the OpenSearch Collection that is created. This will include the necessary Roles for the deployment, as well as any users or roles you would like to add. In order to access the Collection and Index within the Console, you will need to add the appropriate role or user.

```typescript
const bedrockKnowledgeBase = new CustomResource(
  this,
  'KnowledgeBaseCustomResource',
  {
    serviceToken: knowledgeBaseProvider.serviceToken,
    properties: {
      knowledgeBaseBucketArn: props.knowledgeBaseBucket.bucketArn,
      knowledgeBaseRoleArn: this.knowledgeBaseRole.roleArn,
      knowledgeBaseCustomResourceRole: knowledgeBaseCustomResourceRole.roleArn,
      accessPolicyArns: JSON.stringify([]),
      nameSuffix: Names.uniqueId(this).slice(-6).toLowerCase(),
      namePrefix: props.namePrefix,
      knowledgeBaseEmbeddingModelArn:
        'arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v1',
    },
  },
);
```

### Collection

```typescript
const createCollectionResponse = await openSearchServerlessClient.send(
  new CreateCollectionCommand({
    clientToken: randomUUID(),
    type: 'VECTORSEARCH',
    name: `${namePrefix}-${nameSuffix}`,
  }),
);
```

A `VECTORSEARCH` type Collection will be created that will use the previously created policies.

### Index

Once the Collection is created, a [`k-NN`](https://opensearch.org/docs/latest/search-plugins/knn/index/) index will be created. See: https://opensearch.org/docs/latest/search-plugins/knn/knn-index/ for more details on configuring your Index.

```typescript
var createIndexResponse = await client.indices.create({
  index: `${namePrefix}-${nameSuffix}`,
  body: {
    settings: {
      'index.knn': true,
    },
    mappings: {
      properties: {
        [`${namePrefix}-vector`]: {
          type: 'knn_vector',
          dimension: 1536,
          method: {
            name: 'hnsw',
            engine: 'faiss',
            parameters: {
              ef_construction: 512,
              m: 16,
            },
          },
        },
      },
    },
  },
});
```

### Knowledge Base

Once the Collection and Index have been created, the `VECTOR` Knowledge Base using `OPENSEARCH_SERVERLESS` will be created.

```typescript
const data = await bedrockAgentClient.send(
  new CreateKnowledgeBaseCommand({
    clientToken: randomUUID(),
    name: `${namePrefix}-${nameSuffix}`,
    roleArn: knowledgeBaseRoleArn,
    knowledgeBaseConfiguration: {
      type: 'VECTOR',
      vectorKnowledgeBaseConfiguration: {
        embeddingModelArn: knowledgeBaseEmbeddingModelArn,
      },
    },
    storageConfiguration: {
      type: 'OPENSEARCH_SERVERLESS',
      opensearchServerlessConfiguration: {
        collectionArn: collectionArn,
        vectorIndexName: `${namePrefix}-${nameSuffix}`,
        fieldMapping: {
          vectorField: `${namePrefix}-vector`,
          textField: 'text',
          metadataField: 'metadata',
        },
      },
    },
  }),
);
```

### Data Source

Finally, a Data Source will be added using the previously created S3 Bucket.

```typescript
const dataSourceCreateResponse = await bedrockAgentClient.send(
  new CreateDataSourceCommand({
    knowledgeBaseId: knowledgeBaseId,
    clientToken: randomUUID(),
    name: `${namePrefix}-${nameSuffix}`,
    dataSourceConfiguration: {
      type: 'S3',
      s3Configuration: {
        bucketArn: knowledgeBaseBucketArn,
        inclusionPrefixes: ['knowledgeBase'],
      },
    },
  }),
);
```

## Result

We can see the the Knowledge Base has been created, but we still need to select a Model and Sync our data.

![BedrockConsole](/images/BedrockConsole.png)

Let's select `Claude 3 Sonnet` for our Model.

![Model](/images/Model.png)

And now, let's upload a file to the `knowledgeBase` folder in our S3 Bucket. This will automatically trigger a `StartIngestionJob` that will sync our Data Source with our Knowledge Base.

![S3Upload](/images/BucketUpload.png)

Now we can test our Knowledge Base with the uploaded file and get the results back from the uploaded document.

![RAGResults](/images/RAGResult.png)

## Logging
A cloudwatch log group is added with this name:
```
/aws/vendedlogs/bedrock/knowledge-bases/APPLICATION_LOGS/your_kb_id
```
Ingestion jobs logs are stored here, for example:
![Logs](/images/logs.png)
## Deploy

To deploy this demo:

```bash
yarn launch
```

To destroy this demo:

```bash
yarn cdk destroy
```
