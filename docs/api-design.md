# QuickNotes REST API Design

Base URL: `https://api.quicknotes.example/v1`

All request and response bodies are JSON. Except for account creation and sign-in, endpoints require `Authorization: Bearer <access-token>`. The server derives the current user from that token; clients cannot read or change another user's notes by supplying a different owner ID. Note and tag IDs are opaque identifiers.

## Endpoints

| Method | Path | Description | Success status |
| --- | --- | --- | --- |
| `GET` | `/notes?limit=50&cursor={cursor}` | List the authenticated user's notes, newest first; `cursor` is optional. | `200 OK` |
| `GET` | `/notes/{noteId}` | Retrieve one note owned by the authenticated user. | `200 OK` |
| `POST` | `/notes` | Create a note and return its saved representation. | `201 Created` |
| `PATCH` | `/notes/{noteId}` | Update the supplied title, body or tag list for a note. | `200 OK` |
| `DELETE` | `/notes/{noteId}` | Delete a note and its tag links. | `204 No Content` |
| `GET` | `/notes?tagId={tagId}&limit=50` | List the authenticated user's notes that have the selected tag. | `200 OK` |

### Create note request

`POST /v1/notes`

```json
{
  "title": "Ideas for the weekend",
  "body": "Plan a hike and bring the camera.",
  "tagIds": ["tag_01J8K9"]
}
```

### Create note response

`201 Created`

```json
{
  "data": {
    "id": "note_01J8M2",
    "title": "Ideas for the weekend",
    "body": "Plan a hike and bring the camera.",
    "tags": [{ "id": "tag_01J8K9", "name": "personal" }],
    "createdAt": "2026-10-29T11:00:00Z",
    "updatedAt": "2026-10-29T11:00:00Z"
  }
}
```

### List notes response

`GET /v1/notes?limit=50`

```json
{
  "data": [
    {
      "id": "note_01J8M2",
      "title": "Ideas for the weekend",
      "body": "Plan a hike and bring the camera.",
      "tags": [{ "id": "tag_01J8K9", "name": "personal" }],
      "createdAt": "2026-10-29T11:00:00Z",
      "updatedAt": "2026-10-29T11:00:00Z"
    }
  ],
  "page": {
    "limit": 50,
    "nextCursor": null
  }
}
```

## Error responses

Errors use a consistent JSON envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title must be 100 characters or fewer."
  },
  "requestId": "req_01J8M5"
}
```

| Status | Meaning | Example |
| --- | --- | --- |
| `400 Bad Request` | Invalid JSON, missing title or a title longer than 100 characters. | `POST /notes` with an empty title. |
| `401 Unauthorized` | The access token is missing, expired or invalid. | `GET /notes` without a bearer token. |
| `403 Forbidden` | The user is authenticated but is not allowed to perform the action. | A user tries to attach a tag owned by someone else. |
| `404 Not Found` | The note or tag does not exist for this user. | `GET /notes/note_missing`. |
| `500 Internal Server Error` | An unexpected server or dependency failure occurred. | The database is unavailable while saving a note. |

Clients should display the safe `message` to the user and log the `requestId` for support; they should not expose internal stack traces.
