import "dotenv/config";
import express from "express";
import ViteExpress from "vite-express";
import conversationRouter from "./routes/conversation";
import pool from "./db";

const app = express();

app.use(express.json());
app.use("/api", conversationRouter);

const port = Number(process.env.PORT ?? 3000);

const server = ViteExpress.listen(app, port, () =>
  console.log(`Server is listening on port ${port}...`),
);

process.on("SIGINT", () => {
  server.close(() => {
    pool.end().then(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 5000);
});
