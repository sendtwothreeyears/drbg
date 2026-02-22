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

import { runStreamOpenAI } from "../services/runStreamOpenAI";
import { translateText } from "../services/translate";
import { generatePDF } from "../services/generatePDF";
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

    // Disable EventSource auto-reconnect to prevent duplicate streams
    res.write("retry: 86400000\n\n");

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
      // Don't force a single tool — let AI acknowledge the patient first,
      // then call collect_demographics naturally per system prompt instructions.
      toolName = undefined;
    } else if (diagnoses.length === 0) {
      toolName = "generate_differentials";
    }

    await runStreamOpenAI(
      conversationId,
      // onText -> sends chunked messages back to client
      (text) => send({ text }),
      // onTool -> sends chunked messages back to client, notifies if there is a tool
      (tool) => send({ tool }),
      // onAssessmentLoading -> signals assessment generation has started
      () => send({ assessmentLoading: true }),
      // onDone -> signals stream completion with optional metadata, ends connection
      (meta) => {
        send({ done: true, ...meta });
        res.end();
      },
      // OnError — only forward known user-facing messages; generic fallback for unexpected errors
      (err) => {
        const SAFE_MESSAGES = new Set([
          "Translation failed. Your response could not be saved. Please resend your message.",
        ]);
        const message =
          err instanceof Error && SAFE_MESSAGES.has(err.message)
            ? err.message
            : "Stream failed";
        send({ error: message });
        res.end();
      },
      toolName,
    );
  }

  async createConversation(req: Request, res: Response) {
    const { message, language = "en" } = req.body;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    let englishMessage: string;
    try {
      englishMessage = await translateText(message, language, "en");
      if (language !== "en") {
        console.log(`[translate] lang=${language} original=${message.length}chars translated=${englishMessage.length}chars`);
      }
    } catch (error) {
      console.error("Translation failed:", error);
      return res.status(502).json({
        error: "translation_failed",
        message: "Unable to translate your message. Please try again.",
      });
    }

    const GREETINGS: Record<string, string> = {
      en: "I'll help you work through your symptoms. Let's take a closer look.",
      ak: "Mɛboa wo na yɛahwɛ wo yare no mu. Ma yɛnhwɛ mu yie.",
    };

    const greeting = GREETINGS[language] || GREETINGS.en;
    const conversationId = await createConversationMutation(language);
    await createMessageMutation(
      conversationId,
      "assistant",
      GREETINGS.en,
      language !== "en" ? greeting : null,
      language !== "en" ? language : null,
    );
    await createMessageMutation(
      conversationId,
      "user",
      englishMessage,
      language !== "en" ? message : null,
      language !== "en" ? language : null,
    );
    res.json({ conversationId });
  }

  async createConversationMessage(
    req: Request<{ conversationId: string }>,
    res: Response,
  ) {
    const { conversationId } = req.params;
    const { message, language = "en" } = req.body;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    try {
      const englishMessage = await translateText(message, language, "en");
      if (language !== "en") {
        console.log(`[translate] lang=${language} original=${message.length}chars translated=${englishMessage.length}chars`);
      }
      await createMessageMutation(
        conversationId,
        "user",
        englishMessage,
        language !== "en" ? message : null,
        language !== "en" ? language : null,
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Translation failed:", error);
      return res.status(502).json({
        error: "translation_failed",
        message: "Unable to translate your message. Please try again.",
      });
    }
  }

  async createDemographics(
    req: Request<{ conversationId: string }>,
    res: Response,
  ) {
    const { conversationId } = req.params;
    const { toolUseId, age, biologicalSex } = req.body;

    if (typeof age !== "number" || !Number.isInteger(age) || age < 0 || age > 150) {
      return res.status(400).json({ error: "Invalid age" });
    }
    if (!["male", "female"].includes(biologicalSex)) {
      return res.status(400).json({ error: "Invalid biological sex" });
    }
    if (typeof toolUseId !== "string" || !toolUseId) {
      return res.status(400).json({ error: "Invalid tool use ID" });
    }

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

  async getDiagnosesByConversation(
    req: Request<{ conversationId: string }>,
    res: Response,
  ) {
    const { conversationId } = req.params;
    const diagnoses = await getDiagnosesByConversationQuery(conversationId);
    res.json({ diagnoses });
  }

  async exportPDF(req: Request<{ conversationId: string }>, res: Response) {
    const { conversationId } = req.params;

    try {
      const conversation = await getConversationQuery(conversationId);
      if (!conversation?.assessment) {
        return res.status(404).json({ error: "No assessment found" });
      }

      const pdfBuffer = await generatePDF(conversation.assessment);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="boafo-assessment.pdf"');
      res.send(pdfBuffer);
    } catch (error) {
      console.error("[exportPDF] error:", error);
      res.status(500).json({ error: "PDF generation failed" });
    }
  }

  async getConversationAndMessages(
    req: Request<{ conversationId: string }>,
    res: Response,
  ) {
    const { conversationId } = req.params;
    const conversation = await getConversationQuery(conversationId);
    const messages = await getMessagesByConversationQuery(conversationId);
    res.json({
      conversationId,
      createdAt: conversation?.created_at,
      completed: conversation?.completed,
      assessment: conversation?.assessment,
      assessmentSources: conversation?.assessment_sources,
      language: conversation?.language || "en",
      messages,
    });
  }
}

const conversationService = new Conversations();
export default conversationService;
