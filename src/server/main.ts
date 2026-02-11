import "dotenv/config";
import express from "express";
import ViteExpress from "vite-express";
import conversationRouter from "./controllers/conversation";

const app = express();

app.use(express.json());
app.use("/api", conversationRouter);

ViteExpress.listen(app, 3000, () =>
  console.log("Server is listening on port 3000..."),
);
