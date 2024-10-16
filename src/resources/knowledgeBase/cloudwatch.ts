import { randomUUID } from 'crypto';
import {
  CreateLogGroupCommand,
  PutDeliverySourceCommand,
  PutDeliveryDestinationCommand,
  CreateDeliveryCommand,
  CloudWatchLogsClient,
} from '@aws-sdk/client-cloudwatch-logs';

interface CreateLogDeliveryProps {
  knowledgeBaseId: string;
  knowledgeBaseArn: string;
  accountId: string;
}

export const createLogDelivery = async (
  params: CreateLogDeliveryProps,
): Promise<void> => {
  console.log('Creating Log Delivery');
  const { knowledgeBaseId, knowledgeBaseArn, accountId } = params;
  const AWS_REGION = process.env.AWS_REGION;
  const logGroupName = `/aws/vendedlogs/bedrock/knowledge-bases/APPLICATION_LOGS/${knowledgeBaseId}`;
  const cloudWatchLogsClient = new CloudWatchLogsClient({ region: AWS_REGION });

  try {
    // Step 0: Create Log Group
    // Step 1: Put Delivery Source
    await cloudWatchLogsClient.send(
      new CreateLogGroupCommand({
        logGroupName: logGroupName,
      }),
    );

    // Step 1: Put Delivery Source
    console.log('Creating Log Delivery Source:');
    console.log(knowledgeBaseArn);
    const deliverySourcename = `kb-delivery-source-${randomUUID()}`;
    await cloudWatchLogsClient.send(
      new PutDeliverySourceCommand({
        logType: 'APPLICATION_LOGS',
        name: deliverySourcename,
        resourceArn: knowledgeBaseArn,
      }),
    );

    // Step 2: Put Delivery Destination
    const loggroup_arn = `arn:aws:logs:${AWS_REGION}:${accountId}:log-group:${logGroupName}:*`;
    console.log('Creating Log Delivery Destination:');
    console.log(loggroup_arn);
    const destinationResponse = await cloudWatchLogsClient.send(
      new PutDeliveryDestinationCommand({
        deliveryDestinationConfiguration: {
          destinationResourceArn: loggroup_arn,
        },
        name: `kb-delivery-destination-${randomUUID()}`,
        outputFormat: 'json',
      }),
    );

    if (!destinationResponse.deliveryDestination) {
      throw new Error('Failed to create delivery destination');
    }

    // Step 3: Create Delivery
    console.log('Creating Delivery:');
    console.log(deliverySourcename);
    await cloudWatchLogsClient.send(
      new CreateDeliveryCommand({
        deliveryDestinationArn: destinationResponse.deliveryDestination.arn,
        deliverySourceName: deliverySourcename,
      }),
    );

    console.log('Log Delivery created successfully');
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
    }
    throw new Error('Failed to create Log Delivery');
  }
};
