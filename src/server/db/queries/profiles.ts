import db from "../";
import { randomUUID } from "crypto";

const createProfile = (
  conversationId: string,
  age: number,
  biologicalSex: string,
) => {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO user_profiles (profileid, conversationid, age, biological_sex) VALUES (?, ?, ?, ?)",
  ).run(id, conversationId, age, biologicalSex);
  return id;
};

const getProfileByConversation = (conversationId: string) => {
  return db
    .prepare(
      "SELECT * FROM user_profiles WHERE conversationid = ? LIMIT 1",
    )
    .get(conversationId);
};

export { createProfile, getProfileByConversation };
