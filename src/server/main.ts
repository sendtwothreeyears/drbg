import "dotenv/config";
import express from "express";
import ViteExpress from "vite-express";
import { sendMessage } from "./api";
import { createConversation } from "./db/queries/conversations";

const app = express();
const router = express.Router();

app.use(express.json());
app.use("/api", router);

router.post("/create", async (req, res) => {
  const { message } = req.body;
  // db initialization
  createConversation();

  // send message to claude
  const response = await sendMessage(message);
  const newMessage = response.content;

  // return message back to client
});

ViteExpress.listen(app, 3000, () =>
  console.log("Server is listening on port 3000..."),
);
