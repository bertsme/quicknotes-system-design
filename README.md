# QuickNotes System Design

QuickNotes System Design shows how a browser-only note app can grow into an online service. It includes a small front-end client that makes GET, POST and DELETE requests to the JSONPlaceholder practice API, along with API, data-model and architecture documents for a production backend.

## Run the API client

The client uses plain HTML, CSS and JavaScript and needs no build step. Clone this repository, start a local static server from the repository folder, then open the displayed localhost address in a browser:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/` and choose **Load notes**. An internet connection is needed to reach JSONPlaceholder. That practice API returns successful responses for create and delete requests but does not permanently store those changes; the page updates its current list and explains that limitation.

## Design documents

- [API design](docs/api-design.md) — REST endpoints, examples and error responses.
- [Data model](docs/data-model.md) — SQL tables, relationships, indexes and sample queries.
- [Architecture](docs/architecture.md) — requirements, load estimates, request flows and scaling design.

## What I learned

- How a browser client handles asynchronous API requests, loading states and errors.
- How relational tables, foreign keys and a join table protect note and tag relationships.
- How read-heavy traffic changes caching, database and replica choices.
- Why queues keep slow optional work out of the user-facing request path.
