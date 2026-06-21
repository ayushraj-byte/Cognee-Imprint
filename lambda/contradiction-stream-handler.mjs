/**
 * AWS Lambda — triggered by DynamoDB Streams on claude-memories table
 * When a new memory is written, calls the Next.js API to run deep contradiction check.
 *
 * Deploy:
 *   1. zip this file: zip function.zip contradiction-stream-handler.mjs
 *   2. aws lambda create-function --function-name cme-contradiction-stream \
 *        --runtime nodejs20.x --handler contradiction-stream-handler.handler \
 *        --zip-file fileb://function.zip --role arn:aws:iam::ACCOUNT:role/lambda-dynamo-role
 *   3. Add DynamoDB Stream as trigger on the claude-memories table
 *
 * Required env vars on the Lambda:
 *   NEXT_APP_URL  — e.g. https://imprint-ebon.vercel.app
 *   STREAM_HANDLER_SECRET — shared secret matching STREAM_HANDLER_SECRET in Next.js
 */

export async function handler(event) {
  const NEXT_APP_URL = process.env.NEXT_APP_URL;
  const SECRET = process.env.STREAM_HANDLER_SECRET;

  for (const record of event.Records) {
    // Only process INSERT events (new memory saved)
    if (record.eventName !== "INSERT") continue;

    const newImage = record.dynamodb?.NewImage;
    if (!newImage) continue;

    const userId = newImage.userId?.S;
    const memoryId = newImage.memoryId?.S;
    const content = newImage.content?.S;
    const topic = newImage.topic?.S;
    const createdAt = newImage.createdAt?.S;

    if (!userId || !memoryId || !content) continue;

    // Don't run contradiction check on imported memories (batch)
    const source = newImage.source?.S;
    if (source === "import") continue;

    try {
      const res = await fetch(`${NEXT_APP_URL}/api/stream-handler`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-stream-secret": SECRET,
        },
        body: JSON.stringify({
          userId,
          newMemory: { memoryId, content, topic, createdAt },
        }),
      });

      const data = await res.json();
      console.log(`Processed memory ${memoryId} for user ${userId}:`, data);
    } catch (err) {
      console.error(`Failed to process memory ${memoryId}:`, err);
      // Don't throw — we don't want to retry and spam the API
    }
  }

  return { statusCode: 200 };
}
