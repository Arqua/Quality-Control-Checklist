# QC Checklist Backend API

Node.js/Express REST API for the Quality Control Checklist mobile application. Handles synchronization of offline-first data from mobile clients and manages the server-side database.

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- npm or yarn

### Setup

```bash
# Install dependencies
cd backend
npm install

# Create environment file
cp .env.example .env

# Configure your database connection in .env
DATABASE_URL=postgres://user:password@localhost:5432/qc_checklist_db

# Run migrations
npm run migrate

# Start development server
npm run dev
```

The API will be available at `http://localhost:3000`.

## Architecture

### API Endpoints

#### Sync Endpoint
**POST** `/api/sync`

Receives offline-first data from mobile client and syncs to PostgreSQL.

**Request Body**:
```json
{
  "results": [
    {
      "id": "uuid",
      "instance_id": "uuid",
      "template_item_id": "uuid",
      "status": "PASS|FAIL|NA",
      "comments": "...",
      "photo_local_uri": "...",
      "sync_status": "PENDING",
      "created_at": "2026-06-22T...",
      "updated_at": "2026-06-22T..."
    }
  ],
  "punchItems": [
    {
      "id": "uuid",
      "checklist_instance_id": "uuid",
      "template_item_id": "uuid",
      "description": "Failed: ...",
      "status": "OPEN",
      "sync_status": "PENDING",
      "created_at": "2026-06-22T..."
    }
  ],
  "instances": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "template_id": "uuid",
      "inspector_name": "...",
      "status": "COMPLETED",
      "created_at": "...",
      "signed_off_at": "...",
      "inspector_signature": "...",
      "pm_signature": "..."
    }
  ],
  "timestamp": "2026-06-22T..."
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "synced": {
    "resultIds": ["uuid", "uuid", ...],
    "punchItemIds": ["uuid", ...],
    "instanceIds": ["uuid", ...]
  },
  "serverTime": "2026-06-22T..."
}
```

> Results may include an optional `severity` field (`LOW|MEDIUM|HIGH`). It is
> persisted for `FAIL` results and ignored otherwise.

#### Management Alerts (cross-device)

Serious (HIGH-severity) events are raised on the device that records them and
fanned out to other managers via Expo push. The flow:

1. Each manager's device registers its Expo push token once via
   **POST** `/api/devices`.
2. When an inspection records a HIGH-severity failure, the device pushes the
   alert via **POST** `/api/alerts`. The server persists it and sends an Expo
   push to every *other* manager's registered device (respecting project scope).
3. Managers' inboxes pull the full list via **GET** `/api/alerts` and clear
   items with **POST** `/api/alerts/:id/acknowledge`.

**POST** `/api/devices` — register/refresh this device for push.
```json
{ "expoPushToken": "ExponentPushToken[...]", "role": "manager", "projectIds": ["uuid"] }
```
`role` and `projectIds` default to the authenticated user's JWT claims when omitted.
Upserts on the token, so re-registering is safe.

**POST** `/api/alerts` — push raised alerts up (idempotent on alert `id`).
```json
{
  "alerts": [
    {
      "id": "uuid",
      "instance_id": "uuid",
      "result_id": "uuid|null",
      "project_id": "uuid|null",
      "title": "HIGH severity: Rebar spacing",
      "body": "Rebar spacing off on Downtown Office Tower",
      "severity": "HIGH",
      "created_at": "2026-06-22T..."
    }
  ]
}
```
Response: `{ "success": true, "synced": { "alertIds": [...] }, "pushed": <count> }`.
Only newly-stored HIGH-severity alerts trigger a push; re-syncs do not re-notify.

**GET** `/api/alerts?since=<ISO>` — manager-visible alerts, newest first.
Inspectors receive an empty list. Project-scoped managers only see alerts for
their projects (plus project-less alerts).

**POST** `/api/alerts/:id/acknowledge` — mark an alert acknowledged (managers only).

Set `EXPO_ACCESS_TOKEN` only if your Expo project enforces push security;
otherwise the server sends to Expo's push service without it.

### Database Schema (PostgreSQL)

The complete, idempotent schema lives in [`schema.sql`](./schema.sql) and is
applied with `npm run migrate`. The summary below is illustrative.

Mirrors mobile SQLite schema with additions for multi-user support and audit trails:

```sql
-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  created_by UUID NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

-- Templates
CREATE TABLE templates (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  division TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  created_by UUID,
  updated_at TIMESTAMP NOT NULL
);

-- Template Items
CREATE TABLE template_items (
  id UUID PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES templates(id),
  description_text TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL
);

-- Checklist Instances
CREATE TABLE checklist_instances (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  template_id UUID NOT NULL REFERENCES templates(id),
  inspector_id UUID NOT NULL,
  inspector_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMP NOT NULL,
  signed_off_at TIMESTAMP,
  inspector_signature TEXT,
  pm_signature TEXT,
  synced_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL
);

-- Checklist Results
CREATE TABLE checklist_results (
  id UUID PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES checklist_instances(id) ON DELETE CASCADE,
  template_item_id UUID NOT NULL REFERENCES template_items(id),
  status TEXT NOT NULL CHECK (status IN ('PASS', 'FAIL', 'NA')),
  comments TEXT,
  photo_uri TEXT,
  sync_status TEXT DEFAULT 'PENDING',
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  synced_at TIMESTAMP
);

-- Punch Items
CREATE TABLE punch_items (
  id UUID PRIMARY KEY,
  checklist_instance_id UUID NOT NULL REFERENCES checklist_instances(id) ON DELETE CASCADE,
  template_item_id UUID NOT NULL REFERENCES template_items(id),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  sync_status TEXT DEFAULT 'PENDING',
  created_at TIMESTAMP NOT NULL,
  closed_at TIMESTAMP,
  synced_at TIMESTAMP
);

-- Audit Log (optional)
CREATE TABLE sync_log (
  id SERIAL PRIMARY KEY,
  user_id UUID,
  action TEXT NOT NULL,
  payload JSONB,
  synced_at TIMESTAMP NOT NULL,
  result_count INTEGER,
  punch_item_count INTEGER
);
```

## Implementation Guide

### 1. Authentication (Recommended)

Add bearer token authentication to sync endpoint:

```typescript
import jwt from 'jsonwebtoken';

app.post('/api/sync', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  // ... sync logic
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}
```

### 2. Conflict Resolution

Handle concurrent updates with `updated_at` timestamps:

```typescript
async function upsertChecklistResult(result) {
  const existing = await db.query(
    'SELECT * FROM checklist_results WHERE id = $1',
    [result.id]
  );

  if (existing.rows.length === 0) {
    // Insert new
    await db.query(
      'INSERT INTO checklist_results (...) VALUES (...)',
      [...]
    );
  } else if (new Date(result.updated_at) > new Date(existing.rows[0].updated_at)) {
    // Update if client version is newer
    await db.query(
      'UPDATE checklist_results SET ... WHERE id = $1',
      [...]
    );
  }
  // Else ignore (server version is newer)
}
```

### 3. Photo Upload

Handle photo uploads separately or as base64:

```typescript
app.post('/api/photos', async (req, res) => {
  const { photoBase64, instanceId, itemId } = req.body;

  // Save to cloud storage (S3, GCS, etc.)
  const photoUrl = await uploadToS3(
    Buffer.from(photoBase64, 'base64'),
    `photos/${instanceId}/${itemId}.jpg`
  );

  // Update record with cloud URL
  await db.query(
    'UPDATE checklist_results SET photo_uri = $1 WHERE id = $2',
    [photoUrl, itemId]
  );

  res.json({ photoUrl });
});
```

### 4. Logging & Monitoring

Log all sync operations for audit trail:

```typescript
app.post('/api/sync', async (req, res) => {
  const { results, punchItems, instances, timestamp } = req.body;

  // Log sync attempt
  await db.query(
    `INSERT INTO sync_log (user_id, action, payload, synced_at, result_count, punch_item_count)
     VALUES ($1, $2, $3, NOW(), $4, $5)`,
    [userId, 'sync_attempt', JSON.stringify(req.body), results.length, punchItems.length]
  );

  // ... process sync
});
```

## Environment Variables

Create `.env` file:

```env
# Database
DATABASE_URL=postgres://user:password@localhost:5432/qc_checklist_db

# Server
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=your-secret-key

# AWS S3 (for photo uploads)
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_BUCKET=qc-checklist-photos
AWS_REGION=us-east-1
```

## Development

### Running Tests

```bash
npm test
```

### Database Migrations

```bash
# Create new migration
npm run migrate:create add_new_column

# Run pending migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down
```

### Type Safety

```bash
# Check TypeScript
npm run type-check
```

## Deployment

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

```bash
# Build and run
docker build -t qc-checklist-api .
docker run -p 3000:3000 \
  -e DATABASE_URL=postgres://... \
  -e JWT_SECRET=... \
  qc-checklist-api
```

### AWS Lambda

Configure serverless.yml or use AWS SAM for Lambda deployment.

### Heroku

```bash
heroku login
heroku create qc-checklist-api
heroku config:set DATABASE_URL=postgres://...
git push heroku main
```

## Performance Considerations

1. **Batch Syncs**: Group updates by instance to reduce queries
2. **Database Indices**: Add on frequently queried columns
3. **Pagination**: For large result sets, implement cursor-based pagination
4. **Caching**: Consider Redis for template data (rarely changes)
5. **Connection Pooling**: Use PgBouncer for high-concurrency scenarios

## Security Checklist

- [x] Validate all input from mobile clients
- [x] Use parameterized queries (prevent SQL injection)
- [x] Implement rate limiting on sync endpoint
- [x] Require HTTPS in production
- [x] Use environment variables for secrets
- [x] Implement request size limits
- [x] Sanitize file uploads
- [x] Add CORS validation
- [x] Log suspicious activity

## Troubleshooting

### Database Connection Failed
```bash
# Test connection
psql $DATABASE_URL

# Check environment variables
echo $DATABASE_URL
```

### Sync Endpoint Returns 500
- Check server logs: `npm run dev`
- Verify payload format matches schema
- Check database constraints (unique keys, foreign keys)

### CORS Issues
- Ensure mobile client URL is in CORS whitelist
- Update CORS config in Express middleware

## Additional Resources

- [Express Docs](https://expressjs.com)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

See [ARCHITECTURE.md](../ARCHITECTURE.md) for API contract details.
