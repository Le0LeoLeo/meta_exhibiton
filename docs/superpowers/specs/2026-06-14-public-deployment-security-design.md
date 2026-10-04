# Public Deployment Security Design

## Goal

Prepare the application for public deployment by establishing one consistent
authorization model across HTTP APIs and Socket.IO multiplayer behavior.

The design preserves public exhibition viewing while preventing anonymous users
from changing scenes, accessing private exhibition data, or abusing write
endpoints.

## Scope

This change covers:

- JWT configuration and validation
- HTTP gallery and competition authorization
- Socket.IO room admission and scene editing authorization
- Comment and chat access rules
- Rate limiting for authentication and public write endpoints
- Backend security regression tests
- Removal of the tracked runtime SQLite database from the current Git index

Rewriting existing Git history to purge database contents is a separate
deployment operation because it changes shared repository history.

## Authorization Model

### Roles

The server derives one of these effective roles for each exhibition request or
multiplayer room:

- `viewer`: may view an exhibition and receive scene updates
- `participant`: an authenticated viewer who may also chat
- `editor`: may view, chat, and modify the scene through an editor share token
- `owner`: the gallery owner, with full gallery and scene permissions

Roles are calculated by the server. Client-provided role flags such as
`isHost` are never trusted for authorization.

### Public Galleries

- Anonymous visitors may view the gallery, join its multiplayer room, and send
  player movement updates.
- Authenticated users may additionally send chat messages.
- Only the owner or a holder of a valid, unexpired `editor` share token may
  modify or focus scene items.

### Private Galleries

- Anonymous visitors cannot join or read private gallery data without a valid
  share token.
- A valid `viewer` share token permits viewing and player movement.
- A valid `editor` share token permits viewing and scene modification.
- The owner always has full access.

### Room Identity

Multiplayer room IDs are gallery IDs. The Socket.IO server resolves the gallery
from the database before admitting the socket to a room.

The join payload may include a gallery share token. JWT authentication is sent
in the Socket.IO handshake. Neither value is broadcast to other clients.

## JWT Configuration

`JWT_SECRET` has no usable production fallback.

When `NODE_ENV=production`, startup fails if the secret:

- is missing
- is shorter than 32 characters
- equals a documented placeholder or development default

Development may use an explicit development secret, but the server logs a
warning. JWT verification is exposed through a reusable helper so HTTP and
Socket.IO use the same validation behavior.

## Socket.IO Security

The multiplayer server receives these dependencies:

- JWT verification helper
- gallery lookup by ID
- gallery lookup by share token
- allowed CORS origin configuration

On `room:join`, the server:

1. Normalizes the gallery ID.
2. Resolves the authenticated user from the handshake JWT when present.
3. Resolves and validates the optional share token.
4. Determines the effective role.
5. Rejects unauthorized private-gallery access.
6. Stores the role and gallery ID in socket-local session state.

Event authorization:

| Event | Required permission |
| --- | --- |
| `player:move` | admitted viewer |
| `chat:send` | authenticated participant, editor, or owner |
| `scene:sync` | editor or owner |
| `scene:op` | editor or owner |
| `scene:focus` | editor or owner |

Rejected joins and operations emit a structured `room:error` event containing a
stable error code and human-readable message. Unauthorized operations do not
mutate server state or broadcast events.

Scene payloads receive size and shape limits before being stored in memory.
Existing move and chat rate limits remain, with additional scene-operation
limits to prevent memory and CPU abuse.

## HTTP API Security

### Gallery Comments

Gallery comment reads and writes first resolve gallery access:

- published gallery: public read and write
- private gallery: owner or valid share token only
- missing gallery: `404`
- missing credentials for private gallery: `401`
- invalid credentials or insufficient role: `403`

Comment writes receive IP-based rate limiting. Existing field-length validation
remains in place.

### Competition Entries

Public competition detail responses return only entries with status
`approved`.

The competition creator and administrators use authenticated management
endpoints to retrieve all entries. Admin access continues to require both a
valid user JWT and the configured admin credential until a database-backed
administrator role is introduced.

An empty or missing `ADMIN_SECRET` never grants admin access.

### Rate Limiting

Rate limits are applied to:

- registration and login
- public gallery comments
- shared growth comments
- voting
- agent and TTS endpoints

Limits use conservative in-memory fixed windows for the current single-process
deployment. A distributed store is required before horizontally scaling the
server.

## Runtime Data

`server/app.db` is a runtime artifact and remains ignored. It will be removed
from the current Git index without deleting the user's local database.

Before public deployment, repository history must be inspected and, if the
database contains real user data or credentials, rewritten with coordinated
credential rotation.

## Error Semantics

- `400`: malformed input
- `401`: authentication is required or the JWT is invalid
- `403`: authenticated or token-bearing caller lacks permission
- `404`: resource does not exist
- `410`: share or upload link expired or was revoked
- `429`: rate limit exceeded

Public endpoints avoid revealing whether inaccessible private resources exist
when that distinction would expose sensitive information.

## Testing

Tests are added before implementation and cover:

- production startup rejects missing, weak, and placeholder JWT secrets
- valid JWT verification is shared by HTTP and Socket.IO
- anonymous users may join published gallery rooms as viewers
- anonymous users cannot chat or modify scenes
- authenticated non-owners may chat but cannot modify scenes
- owners may modify scenes
- valid viewer share tokens cannot modify scenes
- valid editor share tokens may modify scenes
- expired share tokens are rejected
- private comments cannot be read or written anonymously
- public competition responses expose only approved entries
- missing `ADMIN_SECRET` never grants administrator access
- relevant rate limits return `429`

The existing frontend test suite and production build remain part of the final
verification command.

## Deployment Notes

Production configuration must provide:

- a random `JWT_SECRET` of at least 32 characters
- an explicit frontend CORS origin
- an explicit multiplayer CORS origin
- an `ADMIN_SECRET` if administrator endpoints are enabled
- persistent storage and backup policy for SQLite and uploaded files

TLS termination is required in production so JWTs and share tokens are not sent
over plaintext connections.
