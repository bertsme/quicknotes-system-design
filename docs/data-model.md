# QuickNotes Data Model

The database uses four tables. IDs are integer primary keys in this example; the API can expose opaque string IDs without exposing those internal values.

## Entities and relationships

- **`users`** stores account identity and a password hash, never a plain-text password. One user owns many notes and many tags (one-to-many relationships).
- **`notes`** stores a user's title, body and timestamps. Each note belongs to exactly one user.
- **`tags`** stores reusable labels within one user's account. Each tag belongs to exactly one user, and a user cannot create duplicate tag names in the same account.
- **`note_tags`** links notes and tags. A note can have many tags, and one tag can label many notes, so notes and tags have a many-to-many relationship. This join table stores each note-tag pair once. Its `user_id` and composite foreign keys prevent linking one user's note to another user's tag.

## SQLite schema

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  user_id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
  note_id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (note_id, user_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE tags (
  tag_id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 50),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tag_id, user_id),
  UNIQUE (user_id, name),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE note_tags (
  note_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  PRIMARY KEY (note_id, tag_id),
  FOREIGN KEY (note_id, user_id)
    REFERENCES notes(note_id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id, user_id)
    REFERENCES tags(tag_id, user_id) ON DELETE CASCADE
);

CREATE INDEX idx_notes_user_updated_at
  ON notes(user_id, updated_at DESC);

CREATE INDEX idx_note_tags_tag_id
  ON note_tags(tag_id);
```

The notes index supports the common “show my newest notes” query without sorting every note for every request. The `note_tags` index speeds up finding notes by tag; the table's composite primary key already supports looking up tags for a given note.

## Example queries

### 1. List one user's notes, newest first

```sql
SELECT note_id, title, body, created_at, updated_at
FROM notes
WHERE user_id = :user_id
ORDER BY updated_at DESC
LIMIT :limit;
```

### 2. List a user's notes with a selected tag

```sql
SELECT n.note_id, n.title, n.body, t.name AS tag_name
FROM notes AS n
JOIN note_tags AS nt
  ON nt.note_id = n.note_id AND nt.user_id = n.user_id
JOIN tags AS t
  ON t.tag_id = nt.tag_id AND t.user_id = nt.user_id
WHERE n.user_id = :user_id
  AND t.name = :tag_name
ORDER BY n.updated_at DESC;
```

### 3. Count notes per user, including users with none

```sql
SELECT u.user_id, u.display_name, COUNT(n.note_id) AS note_count
FROM users AS u
LEFT JOIN notes AS n ON n.user_id = u.user_id
GROUP BY u.user_id, u.display_name
ORDER BY u.display_name;
```

### 4. List tags attached to one note

```sql
SELECT t.tag_id, t.name
FROM note_tags AS nt
JOIN tags AS t
  ON t.tag_id = nt.tag_id AND t.user_id = nt.user_id
WHERE nt.user_id = :user_id
  AND nt.note_id = :note_id
ORDER BY t.name;
```

## SQL or NoSQL?

I would choose a relational SQL database. Users, notes and tags have clear ownership rules, and the note-tag relationship needs joins. Foreign keys, unique constraints and transactions make it easier to keep those relationships correct when a note or tag changes. A document database can work for simple embedded tags, but updates and shared tag management become harder to keep consistent as the product grows.
