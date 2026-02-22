import express from "express";

import conversationService from "../controllers/conversation";

const router = express.Router();

router.get("/conversation/:conversationId/stream", (req, res) => {
  conversationService.initiateStream(req, res);
});

router.post("/create", (req, res) => {
  conversationService.createConversation(req, res);
});

router.post("/conversation/:conversationId/message", (req, res) => {
  conversationService.createConversationMessage(req, res);
});

router.post("/conversation/:conversationId/demographics", (req, res) => {
  conversationService.createDemographics(req, res);
});

router.get("/conversation/:conversationId/findings", (req, res) => {
  conversationService.getFindingsByConversation(req, res);
});

router.get("/conversation/:conversationId/diagnoses", (req, res) => {
  conversationService.getDiagnosesByConversation(req, res);
});

router.post("/conversation/:conversationId/pdf", (req, res) => {
  conversationService.exportPDF(req, res);
});

router.get("/conversation/:conversationId", (req, res) => {
  conversationService.getConversationAndMessages(req, res);
});

export default router;
