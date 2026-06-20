/**
 * Run once to create DynamoDB tables + enable Streams
 * Usage: node scripts/setup-dynamo.mjs
 */
import {
  DynamoDBClient,
  CreateTableCommand,
  UpdateTableCommand,
  DescribeTableCommand,
  ResourceInUseException,
} from "@aws-sdk/client-dynamodb";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function tableExists(name) {
  try {
    await client.send(new DescribeTableCommand({ TableName: name }));
    return true;
  } catch {
    return false;
  }
}

async function createMemoriesTable() {
  const name = process.env.DYNAMODB_MEMORIES_TABLE || "claude-memories";

  if (await tableExists(name)) {
    console.log(`✓ Table "${name}" already exists`);
    return;
  }

  await client.send(
    new CreateTableCommand({
      TableName: name,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "PK", AttributeType: "S" },
        { AttributeName: "SK", AttributeType: "S" },
        { AttributeName: "topic", AttributeType: "S" },
        { AttributeName: "createdAt", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "PK", KeyType: "HASH" },
        { AttributeName: "SK", KeyType: "RANGE" },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "topic-index",
          KeySchema: [
            { AttributeName: "topic", KeyType: "HASH" },
            { AttributeName: "createdAt", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        },
      ],
      // TTL is enabled separately (UpdateTimeToLive)
      StreamSpecification: {
        StreamEnabled: true,
        StreamViewType: "NEW_AND_OLD_IMAGES",
      },
    })
  );

  console.log(`✓ Created table "${name}" with Streams enabled`);
}

async function createUsersTable() {
  const name = process.env.DYNAMODB_USERS_TABLE || "claude-memory-users";

  if (await tableExists(name)) {
    console.log(`✓ Table "${name}" already exists`);
    return;
  }

  await client.send(
    new CreateTableCommand({
      TableName: name,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "PK", AttributeType: "S" },
        { AttributeName: "SK", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "PK", KeyType: "HASH" },
        { AttributeName: "SK", KeyType: "RANGE" },
      ],
    })
  );

  console.log(`✓ Created table "${name}"`);
}

async function enableTTL() {
  const name = process.env.DYNAMODB_MEMORIES_TABLE || "claude-memories";
  const { UpdateTimeToLiveCommand } = await import("@aws-sdk/client-dynamodb");

  try {
    await client.send(
      new UpdateTimeToLiveCommand({
        TableName: name,
        TimeToLiveSpecification: {
          Enabled: true,
          AttributeName: "ttl",
        },
      })
    );
    console.log(`✓ TTL enabled on "${name}" (attribute: ttl)`);
  } catch (e) {
    if (e.message?.includes("already")) {
      console.log(`✓ TTL already enabled on "${name}"`);
    } else {
      throw e;
    }
  }
}

async function main() {
  console.log("\n🔧 Setting up DynamoDB tables...\n");
  await createMemoriesTable();
  await createUsersTable();

  // Wait a moment for table to be ACTIVE before enabling TTL
  console.log("⏳ Waiting for tables to be ACTIVE...");
  await new Promise((r) => setTimeout(r, 5000));

  await enableTTL();

  console.log(`
✅ Setup complete!

Tables created:
  - claude-memories    (PK/SK + topic-index GSI + Streams + TTL)
  - claude-memory-users (PK/SK)

Next steps:
  1. Deploy the Lambda function in /lambda to handle DynamoDB Streams
  2. Add the Lambda as a trigger on the claude-memories table stream
  3. Deploy this Next.js app to Vercel
  4. Update NEXT_PUBLIC_APP_URL in .env
`);
}

main().catch(console.error);
