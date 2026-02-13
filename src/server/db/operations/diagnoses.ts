import pool from "../";
import { randomUUID } from "crypto";

type Differential = {
  condition: string;
  confidence: string;
};

const createDiagnosesMutation = async (
  conversationId: string,
  differentials: Differential[],
): Promise<void> => {
  await Promise.all(
    differentials.map((d) =>
      pool.query(
        "INSERT INTO differential_diagnoses (diagnosisid, conversationid, condition, confidence) VALUES ($1, $2, $3, $4)",
        [randomUUID(), conversationId, d.condition, d.confidence],
      )
    )
  );
};

const getDiagnosesByConversationQuery = async (
  conversationId: string,
): Promise<Differential[]> => {
  const { rows } = await pool.query(
    "SELECT condition, confidence FROM differential_diagnoses WHERE conversationid = $1 ORDER BY created_at",
    [conversationId],
  );
  return rows as Differential[];
};

export { createDiagnosesMutation, getDiagnosesByConversationQuery };
