import pool from "../";
import { randomUUID } from "crypto";
import type { Finding } from "../../../types";

const createFindingsMutation = async (conversationId: string, findings: Finding[]): Promise<void> => {
  await Promise.all(
    findings.map((f) =>
      pool.query(
        "INSERT INTO clinical_findings (findingid, conversationid, category, value) VALUES ($1, $2, $3, $4)",
        [randomUUID(), conversationId, f.category, f.value],
      )
    )
  );
};

const getFindingsByConversationQuery = async (conversationId: string): Promise<Finding[]> => {
  const { rows } = await pool.query(
    "SELECT category, value FROM clinical_findings WHERE conversationid = $1 ORDER BY created_at",
    [conversationId],
  );
  return rows as Finding[];
};

export { createFindingsMutation, getFindingsByConversationQuery };
