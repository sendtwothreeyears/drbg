import db from "../";
import { randomUUID } from "crypto";

type Finding = {
  category: string;
  value: string;
};

const createFindings = (conversationId: string, findings: Finding[]) => {
  const insert = db.prepare(
    "INSERT INTO clinical_findings (findingid, conversationid, category, value) VALUES (?, ?, ?, ?)",
  );

  const insertMany = db.transaction((items: Finding[]) => {
    for (const f of items) {
      insert.run(randomUUID(), conversationId, f.category, f.value);
    }
  });

  insertMany(findings);
};

const getFindingsByConversation = (conversationId: string) => {
  return db
    .prepare(
      "SELECT category, value FROM clinical_findings WHERE conversationid = ? ORDER BY created_at",
    )
    .all(conversationId) as Finding[];
};

export { createFindings, getFindingsByConversation };
