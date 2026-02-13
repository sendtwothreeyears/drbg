import pool from "../";
import { randomUUID } from "crypto";

const createProfileMutation = async (
  conversationId: string,
  age: number,
  biologicalSex: string,
): Promise<string> => {
  const id = randomUUID();
  await pool.query(
    "INSERT INTO user_profiles (profileid, conversationid, age, biological_sex) VALUES ($1, $2, $3, $4)",
    [id, conversationId, age, biologicalSex],
  );
  return id;
};

const getProfileByConversationQuery = async (conversationId: string) => {
  const { rows } = await pool.query(
    "SELECT * FROM user_profiles WHERE conversationid = $1 LIMIT 1",
    [conversationId],
  );
  return rows[0];
};

export { createProfileMutation, getProfileByConversationQuery };
