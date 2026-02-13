import pg from "pg";

const pool = new pg.Pool({
  host: "localhost",
  port: 5432,
  database: process.env.DATABASE ?? "cb",
  user: process.env.PG_USER ?? "postgres",
  password: process.env.PG_PASSWORD ?? "",
});

export default pool;
