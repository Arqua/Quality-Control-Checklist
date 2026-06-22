# QC Checklist Mobile App - Architecture Guide

## Overview

The QC Checklist app is a **offline-first** mobile application designed for construction site inspectors to perform quality control checks using React Native, Expo, and SQLite. All operations occur locally first, with automatic background synchronization to a backend server when connectivity is available.

---

## Project Structure

```
qc-checklist/
├── app/                           # Expo Router app directory
│   ├── _layout.tsx               # Root navigation layout
│   ├── (home)/                   # Home stack navigator
│   │   ├── _layout.tsx          # Home stack configuration
│   │   ├── index.tsx            # HomeScreen - Project selection & active checklists
│   │   └── new-checklist.tsx    # NewChecklistScreen - Template selection
│   └── (inspection)/             # Inspection stack navigator
│       ├── _layout.tsx          # Inspection stack configuration
│       └── index.tsx            # InspectionScreen - Main checklist interface
│
├── src/                          # Source code for logic & utilities
│   ├── database/
│   │   └── db.ts               # SQLite database initialization, schema, and CRUD
│   ├── hooks/
│   │   └── useChecklist.ts     # Custom React hook for checklist state + sync queue
│   └── types/
│       └── database.ts         # TypeScript type definitions for all entities
│
├── package.json                # Dependencies & npm scripts
├── app.json                    # Expo configuration
├── tsconfig.json               # TypeScript configuration
├── tailwind.config.js          # Tailwind CSS (NativeWind) configuration
├── babel.config.js             # Babel configuration for NativeWind
└── .env.example               # Environment variables template
```

---

## Data Layer: SQLite Schema

### Tables

#### `projects`
Stores construction project metadata.
- **id** (TEXT, PK): UUID
- **name** (TEXT): Project name
- **location** (TEXT): Physical location/address
- **created_at** (TEXT): ISO timestamp

#### `templates`
Master QC checklist templates by division (e.g., "Concrete Pouring", "Electrical Rough-In").
- **id** (TEXT, PK): UUID
- **name** (TEXT): Template name (e.g., "Pre-Pour Concrete")
- **division** (TEXT): Category/division
- **created_at** (TEXT): ISO timestamp

#### `template_items`
Individual items within a template.
- **id** (TEXT, PK): UUID
- **template_id** (TEXT, FK): References `templates.id`
- **description_text** (TEXT): The inspection item description
- **sort_order** (INTEGER): Display order within template

#### `checklist_instances`
A specific instantiation of a template for a project/location.
- **id** (TEXT, PK): UUID
- **project_id** (TEXT, FK): References `projects.id`
- **template_id** (TEXT, FK): References `templates.id`
- **inspector_name** (TEXT): Inspector who performed the check
- **status** (TEXT): 'DRAFT' | 'COMPLETED'
- **created_at** (TEXT): ISO timestamp
- **signed_off_at** (TEXT, nullable): When checklist was completed
- **inspector_signature** (TEXT, nullable): Base64 or URI of inspector signature
- **pm_signature** (TEXT, nullable): Base64 or URI of PM signature

#### `checklist_results`
The result/response for each item in a checklist instance.
- **id** (TEXT, PK): UUID
- **instance_id** (TEXT, FK): References `checklist_instances.id`
- **template_item_id** (TEXT, FK): References `template_items.id`
- **status** (TEXT): 'PASS' | 'FAIL' | 'NA'
- **comments** (TEXT, nullable): Inspector notes/discrepancies
- **photo_local_uri** (TEXT, nullable): Local file URI of attached photo
- **sync_status** (TEXT): 'PENDING' | 'SYNCED' (offline-first flag)
- **created_at** (TEXT): ISO timestamp
- **updated_at** (TEXT): ISO timestamp (for conflict detection)

#### `punch_items`
Automatically generated defect/rework items for failed inspections.
- **id** (TEXT, PK): UUID
- **checklist_instance_id** (TEXT, FK): References `checklist_instances.id`
- **template_item_id** (TEXT, FK): References `template_items.id`
- **description** (TEXT): Failure description (auto-populated from template item + comments)
- **status** (TEXT): 'OPEN' | 'CLOSED'
- **sync_status** (TEXT): 'PENDING' | 'SYNCED'
- **created_at** (TEXT): ISO timestamp

---

## State Management: `useChecklist` Hook

Located in `src/hooks/useChecklist.ts`, this custom React hook manages:

### State
- **instance**: Current `ChecklistInstance` being edited
- **items**: Template items for the checklist
- **results**: Map<templateItemId, ChecklistResult> for O(1) lookups
- **loading**: Initial data load status
- **syncing**: Ongoing background sync status
- **error**: Error messages

### Key Functions

#### `updateItemStatus(templateItemId, status, comments?, photoUri?)`
Updates or creates a `ChecklistResult` for a given item. Automatically creates `PunchItem` if status === 'FAIL'.

#### `completeChecklist(inspectorSignature, pmSignature?)`
Marks the checklist as 'COMPLETED' and stores signatures locally.

#### `manualSync()`
Triggers immediate background sync attempt to backend.

#### `attemptSync()` (internal)
- Queries `getPendingSyncPayload()` from DB
- Calls `syncToBackend()` stub function
- Marks synced items as 'SYNCED' in local DB
- Runs automatically every 30 seconds and after each state change

### Sync Flow
```
User updates item status
       ↓
updateItemStatus() → DB.updateChecklistResult()
       ↓
Set result.sync_status = 'PENDING'
       ↓
Hook detects change → attemptSync()
       ↓
If online: POST /api/sync with payload
       ↓
Backend responds ✓ → DB.markAsSynced()
       ↓
If offline/error: Retry in 30s (data persists locally)
```

---

## Key Features & Implementation

### 1. Offline-First Architecture
- All writes are local (SQLite) first
- `sync_status` flag tracks what needs sync
- Periodic background sync (30s interval)
- Manual sync button for user control

### 2. Automatic Issue Generation
- When `ChecklistResult.status = 'FAIL'`, a `PunchItem` is created automatically
- Punch items are queued for sync alongside results
- Enables downstream punch list management

### 3. Navigation Flow
```
HomeScreen (Project Selection)
    ↓
    [Select Project] → Shows active checklists
    ↓
    [New Checklist] → NewChecklistScreen (template selection)
    ↓
    [Create] → Navigates to InspectionScreen
    ↓
InspectionScreen (Interactive Checklist)
    ↓
    [Complete all items] → [Sign Off & Complete] button enabled
    ↓
    [Sign Off Modal] → Inspector + PM signatures
    ↓
    [Submit] → Mark as COMPLETED, sync payload queued
    ↓
    Return to HomeScreen
```

### 4. UI/UX for Field Conditions
- **High Contrast**: Orange (#FF6B35) and Dark Blue (#004E89) for sunlight visibility
- **Quick Actions**: Pass/Fail/N/A buttons are large and tactile
- **Progress Tracking**: Visual bar + percentage in header
- **Minimal Scrolling**: Scrollable item list, fixed controls
- **Photo Integration**: Placeholder for camera/gallery (expandable to actual CameraRoll integration)

---

## Database Initialization & Seeding

On app launch, `getDatabase()` in `src/database/db.ts`:
1. Opens/creates SQLite database
2. Runs `initializeDatabase()` which:
   - Creates all tables with foreign keys enabled
   - Sets WAL (Write-Ahead Logging) mode for concurrency
3. Runs `seedDatabase()` which:
   - Checks if templates exist (idempotent)
   - If empty, creates:
     - Sample project: "Downtown Office Tower"
     - "Pre-Pour Concrete" template under "Concrete Pouring" division
     - 5 checklist items (Subgrade, Formwork, Rebar, Slump, Curing)

---

## API Contract (Stub)

### Sync Endpoint
**POST** `/api/sync`

**Request Body** (`SyncPayload`):
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
    "resultIds": ["uuid", ...],
    "punchItemIds": ["uuid", ...],
    "instanceIds": ["uuid", ...]
  }
}
```

---

## Development Setup

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator or Android Emulator (or physical device)

### Installation
```bash
# Clone repo
git clone <repo-url>
cd qc-checklist

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Start Expo dev server
npm start

# Choose platform:
# Press 'i' for iOS Simulator
# Press 'a' for Android Emulator
# Press 'w' for Web
# Scan QR code for physical device
```

### Building
```bash
# Development build for physical testing
expo build:ios --type simulator
expo build:android --type apk

# Production build
eas build --platform ios --type production
eas build --platform android --type production
```

---

## Testing Checklist

- [ ] HomeScreen loads projects & checklists
- [ ] Can select project and view active checklists
- [ ] Can create new checklist (NewChecklistScreen template selection)
- [ ] InspectionScreen loads all items
- [ ] Pass/Fail/N/A buttons toggle correctly
- [ ] Comments text input saves with item
- [ ] Progress bar updates in real-time
- [ ] "Sign Off" button disabled until all items completed
- [ ] Sign-off modal captures signatures
- [ ] Checklist marked COMPLETED after sign-off
- [ ] Sync status shows in header
- [ ] Manual sync button works (network stub)
- [ ] Navigating away and back loads persisted data
- [ ] Offline mode: operations work without connectivity
- [ ] Network restored: background sync queues and processes

---

## Next Steps for Backend Integration

1. **Backend API**: Implement `/api/sync` endpoint in Node.js/Express or FastAPI
   - Validate `SyncPayload`
   - Upsert records to PostgreSQL (handle conflicts with `updated_at`)
   - Return synced IDs

2. **Database Schema** (PostgreSQL):
   - Mirror SQLite tables (with additional fields: server-side timestamps, user IDs)
   - Add audit trail / sync history table

3. **Authentication**:
   - Add user login/session to app
   - Pass auth token in sync requests
   - Backend validates and associates data with user/project

4. **Real-time Collaboration**:
   - WebSocket for multi-user checklist editing (optional)
   - Conflict resolution strategy for concurrent updates

5. **Photo Management**:
   - Replace photo URI placeholders with actual upload to S3/GCS
   - On sync, include photo as multipart or base64

6. **Signature Storage**:
   - Convert canvas drawing to PNG/PDF
   - Store as base64 or upload to cloud storage

---

## Performance Considerations

- **SQLite Queries**: All queries are indexed by primary key; consider adding indices on `(instance_id)`, `(project_id)` for frequent lookups
- **Sync Payload Size**: For large checklists (100+ items), consider pagination/chunking
- **Local File Storage**: Photos stored in device FileSystem; clean up old/orphaned files periodically
- **Memory**: Map<templateItemId, ChecklistResult> is O(n) memory; acceptable for typical checklist sizes (~50 items)

---

## Security Notes

- **No sensitive data in logs**: Remove console logs before production
- **Signature storage**: Store base64 or encrypted; never plain text
- **Photo privacy**: Ensure EXIF data is stripped before upload (if photos used)
- **API auth**: Implement bearer token or OAuth 2.0 for backend calls
- **HTTPS only**: All sync calls must use HTTPS in production
