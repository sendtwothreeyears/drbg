CREATE TABLE IF NOT EXISTS users (
	userid TEXT PRIMARY KEY,
	created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations  (
	conversationid TEXT PRIMARY KEY,
	created_at TEXT DEFAULT CURRENT_TIMESTAMP,
	authorid INTEGER,
	FOREIGN KEY(authorid) REFERENCES users(userid)
);

CREATE TABLE IF NOT EXISTS messages (
	messageid TEXT PRIMARY KEY,
	created_at TEXT DEFAULT CURRENT_TIMESTAMP,
	content TEXT,
	role TEXT,
	conversationid TEXT,
	FOREIGN KEY(conversationid) REFERENCES conversations(conversationid)
);
