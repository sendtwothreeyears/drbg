import { Request, Response } from "express";
import {
  getMessagesByConversationQuery,
  createMessageMutation,
} from "../db/operations/messages";

import { getFindingsByConversationQuery } from "../db/operations/findings";

import {
  createConversationMutation,
  getConversationQuery,
} from "../db/operations/conversations";

import {
  createProfileMutation,
  getProfileByConversationQuery,
} from "../db/operations/profiles";

import { getDiagnosesByConversationQuery } from "../db/operations/diagnoses";

import { runStream } from "../services/runStream";
import { StreamEvent } from "../../types";

class Conversations {
  constructor() {}

  async initiateStream(
    req: Request<{ conversationId: string }>,
    res: Response,
  ) {
    // SSE - Stream initialization
    const { conversationId } = req.params;

    // Tells the browser "this is an SSE stream, not a normal response"
    res.setHeader("Content-Type", "text/event-stream");
    // Tells the browser "don't cache this, it's live data"
    res.setHeader("Cache-Control", "no-cache");
    // Tells the browser "keep this connection open, more data is coming"
    res.setHeader("Connection", "keep-alive");
    // Flush =  Send them to client immediately to start the stream where EventSource is listening.
    // We don't wait until data is available, we make sure the stream is active first and then actively write to it.
    res.flushHeaders();

    let closed = false;
    // when browser tab closed, or client's eventSource.close() called
    req.on("close", () => {
      closed = true;
    });

    const send = (data: StreamEvent) => {
      // each res.write() during stream writes back to the response body
      if (!closed) res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const profile = await getProfileByConversationQuery(conversationId);
    const diagnoses = await getDiagnosesByConversationQuery(conversationId);

    let toolName: string | undefined;
    if (!profile) {
      toolName = "collect_demographics";
    } else if (diagnoses.length === 0) {
      toolName = "generate_differentials";
    }

    await runStream(
      conversationId,
      // onText -> sends chunked messages back to client
      (text) => send({ text }),
      // onTool -> sends chunked messages back to client, notifies if there is a tool
      (tool) => send({ tool }),
      // onDone -> sends final message back to user, ends connection
      () => {
        send({ done: true });
        res.end();
      },
      // OnError
      () => {
        send({ error: "Stream failed" });
        res.end();
      },
      toolName,
    );
  }

  async createConversation(req: Request, res: Response) {
    const { message } = req.body;
    const conversationId = await createConversationMutation();
    await createMessageMutation(
      conversationId,
      "assistant",
      "I'll help you work through your symptoms. Let's take a closer look.",
    );
    await createMessageMutation(conversationId, "user", message);
    res.json({ conversationId });
  }

  async createConversationMessage(
    req: Request<{ conversationId: string }>,
    res: Response,
  ) {
    const { conversationId } = req.params;
    const { message } = req.body;
    await createMessageMutation(conversationId, "user", message);
    res.json({ success: true });
  }

  async createDemographics(
    req: Request<{ conversationId: string }>,
    res: Response,
  ) {
    const { conversationId } = req.params;
    const { toolUseId, age, biologicalSex } = req.body;

    await createProfileMutation(conversationId, age, biologicalSex);

    const toolResultContent = JSON.stringify([
      {
        type: "tool_result",
        tool_use_id: toolUseId,
        content: `Patient demographics collected: Age ${age}, Sex ${biologicalSex}`,
      },
    ]);
    await createMessageMutation(conversationId, "user", toolResultContent);

    res.json({ success: true });
  }

  async getFindingsByConversation(
    req: Request<{ conversationId: string }>,
    res: Response,
  ) {
    const { conversationId } = req.params;
    const findings = await getFindingsByConversationQuery(conversationId);
    res.json({ findings });
  }

  async getConversationAndMessages(
    req: Request<{ conversationId: string }>,
    res: Response,
  ) {
    const { conversationId } = req.params;
    const conversation = await getConversationQuery(conversationId);
    const messages = await getMessagesByConversationQuery(conversationId);
    res.json({ conversationId, createdAt: conversation?.created_at, messages });
  }
}

const conversationService = new Conversations();
export default conversationService;
