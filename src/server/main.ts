import express from "express";
import ViteExpress from "vite-express";

import { sendMessage } from "./api";

const app = express();

app.get("/hello", (req, res) => {});

ViteExpress.listen(app, 3000, () =>
  console.log("Server is listening on port 3000..."),
);
