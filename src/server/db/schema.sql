CREATE TABLE IF NOT EXISTS users (
	userid TEXT PRIMARY KEY,
	created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations  (
	conversationid TEXT PRIMARY KEY,
	title TEXT,
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

CREATE TABLE IF NOT EXISTS user_profiles (
	profileid TEXT PRIMARY KEY,
	conversationid TEXT NOT NULL,
	age INTEGER,
	biological_sex TEXT CHECK(biological_sex IN ('male', 'female')),
	created_at TEXT DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY(conversationid) REFERENCES conversations(conversationid)
);
