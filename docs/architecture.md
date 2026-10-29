# QuickNotes System Architecture

## Functional requirements

- Users can register, sign in and access only their own notes and tags.
- Users can create, list, read, edit and delete notes.
- Users can tag notes, filter a list by tag and search note titles and bodies.
- The service validates input, preserves note ownership and returns useful errors.

## Non-functional requirements

- **Availability:** target 99.9% monthly API availability, with redundant instances and automated health checks.
- **Performance:** return common cached note-list reads in under 200 ms at the 95th percentile under normal load.
- **Durability:** commit a successful note write to the primary database before returning `201 Created`; back up the database and test restoration.
- **Security:** use TLS, hashed passwords, short-lived access tokens, per-user authorization checks and rate limits.
- **Scalability:** add application instances horizontally and increase read capacity without putting note content in process memory.

## Load estimate for 1 million registered users

### Assumptions

- 10% of registered users are active each day: 1,000,000 × 10% = **100,000 daily active users**.
- Each active user makes 20 note-list or note-detail read requests per day: **2,000,000 reads/day**.
- Each active user creates two new notes per day: **200,000 writes/day**.
- One note averages 2 KB including its title, body and basic metadata. Attachments are out of scope and would use object storage.
- Requests are evenly distributed for the average rate. A 5× multiplier is used as a planning peak. Storage uses decimal units and keeps notes for 365 days; it excludes indexes, replicas and backups.

| Measure | Calculation | Average | Planning peak |
| --- | --- | ---: | ---: |
| Reads per second | 100,000 × 20 ÷ 86,400 | **23 reads/s** | **116 reads/s** |
| Writes per second | 100,000 × 2 ÷ 86,400 | **2.3 writes/s** | **12 writes/s** |
| New notes per year | 200,000 × 365 | **73 million notes** | — |
| Note storage per year | 73 million × 2 KB | **146 GB/year** | — |

The workload is read-heavy at about 10 reads per write. The read replica and cache handle repeated list traffic, while note changes go to the primary database.

## Architecture diagram

```text
┌──────────────┐  ┌─────┐  ┌────────────────────┐  ┌──────────────────────┐
│ Web / mobile │─>│ DNS │─>│ CDN / Edge         │─>│ Redundant Load       │
│ client       │  └─────┘  │ static + API route │  │ Balancer             │
└──────┬───────┘           └────────────────────┘  └──────────┬───────────┘
       ▲                                                   │
       │ JSON over HTTPS                         ┌─────────┴─────────┐
       │                                          │                   │
       │                                     ┌────▼─────┐        ┌────▼─────┐
       │                                     │ App      │        │ App      │
       │                                     │ Server A │        │ Server B │
       │                                     └──┬───┬───┘        └──┬───┬───┘
       │                                        │   └──────┬────────┘   │
       │                                        │       ┌──▼───┐        │
       │                                        │       │ Cache│        │
       │                                        │       └──────┘        │
       │                                writes │                  reads│
       │                                  ┌─────▼──────┐    ┌──────────▼─┐
       │                                  │ Primary DB │───>│ Read       │
       │                                  │ multi-AZ   │    │ Replica    │
       │                                  └──────┬─────┘    └────────────┘
       │                                         │ publish event
       │                                  ┌──────▼──────┐    ┌───────────┐
       └──────────────────────────────────│ Message     │───>│ Worker    │
                                          │ Queue       │    │ search /  │
                                          └─────────────┘    │ reminders │
                                                             └───────────┘
```

The CDN serves versioned static client files and forwards dynamic API requests to the load balancer rather than caching private note responses.

## Component responsibilities

- **Client:** renders the note interface and sends authenticated JSON requests over HTTPS.
- **DNS:** resolves the service name to the edge provider and can route traffic away from an unhealthy region.
- **CDN and edge:** serves static files close to users and forwards uncached API traffic while keeping private note responses out of a shared cache.
- **Load balancer:** distributes API traffic across healthy app instances in multiple availability zones.
- **App servers:** authenticate users, enforce note ownership, validate input and coordinate cache, database and queue operations.
- **Cache:** serves frequently requested user-scoped note lists quickly and reduces repeated database reads.
- **Primary database:** durably stores users, notes, tags and their relationships and accepts all writes.
- **Read replica:** serves note-list reads so read traffic does not compete with writes on the primary.
- **Message queue:** stores background work durably so optional indexing and reminder tasks do not delay an API response.
- **Worker:** processes queued search-index and reminder jobs and retries transient failures without blocking the web request.

## Request flows

### `GET /v1/notes`

1. The client resolves the API hostname through DNS and sends an authenticated HTTPS request through the edge and load balancer.
2. The load balancer selects a healthy application server. The app validates the token and derives the user ID from it.
3. The app checks the cache using a key that includes the user ID and query parameters. A cache hit returns the JSON page immediately.
4. On a cache miss, the app reads the user's notes from the read replica, ordered by `updated_at`, and stores the result in the cache for a short TTL.
5. The app returns the JSON notes and pagination cursor. The client renders the page with safe text handling.

### `POST /v1/notes`

1. The client sends an authenticated JSON request containing the note title, body and optional tag IDs.
2. An app server validates the title length, checks that each tag belongs to the authenticated user and starts a database transaction.
3. The app inserts the note and its tag links into the primary database, commits the transaction and invalidates the affected user's note-list cache keys.
4. The app publishes an optional indexing or reminder event to the queue and returns `201 Created` with the saved note.
5. A worker handles the queued task later; if the worker is unavailable, the durable queue retains the job for retry.

## Trade-offs and failure handling

- **Cache speed versus freshness:** a short TTL makes repeated reads fast but can briefly show stale content. Create, update and delete operations invalidate that user's affected keys; a miss falls back to the read replica.
- **Read replica capacity versus replication lag:** the replica protects the primary from read load but may be behind immediately after a write. The app can briefly read a newly changed note from the primary or return the write response directly to the client.
- **Asynchronous work versus immediate completion:** the queue keeps optional indexing and reminders out of the request path, but those features can lag. The app reports the note as saved once the database transaction commits and monitors queue age and retry counts.
- **Redundancy versus operating cost:** multiple app servers, a multi-zone database, replicated queue and redundant edge/load-balancer services cost more, but remove single points of failure. Health checks, automatic failover, backups and recovery exercises cover the primary database and infrastructure dependencies.

The API servers are stateless, so a failed instance can be replaced without losing notes. The load balancer spans multiple zones; the database has a managed standby/read replica and backups; and the queue, cache and DNS/CDN providers use redundant managed deployments. Monitoring tracks availability, p95 latency, error rates, database lag, cache hit rate and queue age.
