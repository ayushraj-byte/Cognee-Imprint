import { NextResponse } from "next/server";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

export async function GET() {
  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  try {
    const command = new InvokeModelCommand({
      modelId: "anthropic.claude-3-5-haiku-20241022-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 10,
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    const response = await client.send(command);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({
      error: err.message,
      code: err.name,
      status: err.$metadata?.httpStatusCode,
      keyPrefix: process.env.AWS_ACCESS_KEY_ID?.slice(0, 8),
      region: process.env.AWS_REGION,
    });
  }
}
