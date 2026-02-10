import "dotenv/config";
import express from "express";
import ViteExpress from "vite-express";
import { sendMessage } from "./api";

const app = express();
const router = express.Router();

app.use(express.json());
app.use("/api", router);

router.post("/sendMessage", async (req, res) => {
  const { message } = req.body;
  const response = await sendMessage(message);
  const newMessage = response.content;
});

ViteExpress.listen(app, 3000, () =>
  console.log("Server is listening on port 3000..."),
);
