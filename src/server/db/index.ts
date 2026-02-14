import pg from "pg";

const pool = new pg.Pool({
  host: process.env.INSTANCE_UNIX_SOCKET ?? "localhost",
  port: process.env.INSTANCE_UNIX_SOCKET ? undefined : Number(process.env.PG_PORT ?? 5432),
  database: process.env.DATABASE ?? "cb",
  user: process.env.PG_USER ?? "postgres",
  password: process.env.PG_PASSWORD ?? "",
});

export default pool;
