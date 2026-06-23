# Quality Control Checklist Mobile App

A cross-platform **offline-first** mobile application for construction site quality control inspections using React Native, Expo, and SQLite. Built for unreliable connectivity environments with automatic background synchronization, role-based access, and cross-device management alerts.

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and npm
- **Expo CLI**: `npm install -g expo-cli`
- iOS Simulator (macOS) or Android Emulator, or physical device with Expo Go app

### Installation & Running

```bash
# Clone and navigate to project
git clone <repo-url>
cd qc-checklist

# Install dependencies
npm install

# Configure environment (optional in dev; required for a production backend URL)
# Set EXPO_PUBLIC_API_URL to point the app at your backend
cp .env.example .env.local

# Start development server
npm start

# Choose platform:
#   i  → iOS Simulator
#   a  → Android Emulator
#   w  → Web (limited functionality)
#   s  → Choose simulator
#   q  → Quit

# For physical device: scan QR code with Expo Go app
```

### Demo Login Accounts

The app gates access behind a login screen. For field testing, the following
static accounts are available (a production deployment would validate these
against the backend):

| Username    | Password | Role      | Capabilities                          |
|-------------|----------|-----------|---------------------------------------|
| `manager`   | `1234`   | Manager   | Management mode + alerts inbox        |
| `admin`     | `1234`   | Manager   | Management mode + alerts inbox        |
| `inspector` | `1234`   | Inspector | Inspections only                      |

### Running Tests & Quality Checks

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Run test suite
npm test
```

## 📋 Features

### Core Functionality
- **Authentication & Roles**: Login screen with persisted sessions and two roles (Inspector / Manager)
- **Project Selection**: Switch between multiple active construction projects
- **Template-Based Checklists**: Pre-configured QC templates by division (Concrete Pouring, Framing, etc.)
- **Template & Project Management**: Create new projects and templates in-app
- **Interactive Inspection**: Quick-action buttons (Pass/Fail/N/A) for each item
- **Severity Ratings**: Failed items are classified LOW / MEDIUM / HIGH
- **Comments & Notes**: Inline text fields for discrepancies and observations
- **Photo Attachments**: Capture from camera or pick from gallery (via `expo-camera` / `expo-image-picker`)
- **Automated Issue Generation**: Failed items automatically create punch list entries
- **Digital Sign-Off**: Real on-screen signature capture for Inspector and Project Manager (`react-native-signature-canvas`)
- **PDF Export**: Generate and share a completed inspection report (`expo-print` / `expo-sharing`)

### Management Mode & Alerts
- **Manager-Only Inbox**: A dedicated alerts screen visible to management accounts
- **Serious-Event Alerts**: HIGH-severity failures raise an alert with a local push notification
- **Cross-Device Fan-Out**: When a backend is configured, alerts sync up and other managers' devices are push-notified via Expo
- **Acknowledgement**: Managers can acknowledge/clear alerts; project-scoped managers only see alerts for their projects

### Offline-First Architecture
- ✅ All operations work without internet connectivity
- ✅ Local SQLite database for all data storage
- ✅ Automatic background sync every 30 seconds when online
- ✅ Manual sync button for user control
- ✅ Sync status indicators in UI
- ✅ Photo upload lifecycle tracking (local → remote object storage)

### User Interface
- **High-Contrast Design**: Optimized for sunlight and dusty environments
- **Large Tactile Buttons**: Easy to use with gloved hands
- **Progress Tracking**: Real-time pass/fail/NA counts and percentage completion
- **Responsive Layout**: Adapts to phone and tablet screens
- **Dark Mode Ready**: Built with Tailwind CSS (NativeWind) for theme flexibility

## 📁 Project Structure

```
qc-checklist/
├── app/                          # Expo Router navigation
│   ├── _layout.tsx              # Root layout (auth gating)
│   ├── login.tsx                # Login screen
│   ├── (home)/                  # Home stack
│   │   ├── index.tsx            # Project selection & checklists list
│   │   ├── new-checklist.tsx    # Template selection / creation
│   │   └── alerts.tsx           # Manager-only alerts inbox
│   └── (inspection)/             # Inspection stack
│       └── index.tsx            # Main checklist interface
│
├── src/
│   ├── auth/
│   │   └── authContext.tsx      # Auth provider, roles, session persistence
│   ├── config/
│   │   └── env.ts               # Runtime config (backend URL, auth token)
│   ├── database/
│   │   └── db.ts               # SQLite schema, initialization, CRUD ops
│   ├── hooks/
│   │   └── useChecklist.ts     # State management & sync queue
│   ├── services/
│   │   ├── sync.ts             # Backend sync client
│   │   ├── photos.ts           # Camera/gallery capture
│   │   ├── notifications.ts    # Local & push notifications
│   │   └── pdf-export.ts       # PDF report generation
│   ├── components/
│   │   └── Notification.tsx     # In-app notification banner
│   └── types/
│       └── database.ts         # TypeScript interfaces
│
├── backend/                     # Node.js/Express + PostgreSQL sync API
│   ├── src/                     # API, auth, validation, push, storage
│   ├── schema.sql               # PostgreSQL schema
│   └── README.md                # Backend setup & API contract
│
├── ARCHITECTURE.md              # Detailed architecture & design docs
├── package.json
├── tsconfig.json
├── app.json                     # Expo config
└── tailwind.config.js          # Tailwind CSS (NativeWind)
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed documentation and
[backend/README.md](./backend/README.md) for the sync API.

## 🗄️ Data Model

### SQLite Tables (mobile)
- **projects**: Construction projects
- **templates**: Master QC checklists by division
- **template_items**: Individual inspection items
- **checklist_instances**: Active checklist instances tied to projects
- **checklist_results**: Pass/Fail/NA results (with optional `severity`) for each item
- **punch_items**: Auto-generated defect items from failures
- **alerts**: Management alerts raised by HIGH-severity events

All tables support full offline-first sync with `sync_status` flags. Photo
attachments additionally track a `photo_sync_status` lifecycle
(`NONE → PENDING → UPLOADED`).

### Sample Seed Data
On first app launch, the database is initialized with:
- **Sample Project**: "Downtown Office Tower" at "Block A - 123 Main St"
- **Template**: "Pre-Pour Concrete" under "Concrete Pouring" division
- **5 Checklist Items**:
  1. Subgrade compaction verification
  2. Formwork alignment and level
  3. Rebar spacing and clearance
  4. Slump test logging
  5. Curing compound application

## 🔄 Sync Architecture

### Offline-First Flow
1. User performs inspection (updates item status, adds severity/comments, attaches photos)
2. Data saved immediately to local SQLite
3. Items marked `sync_status = 'PENDING'`
4. Background sync attempts to send to the backend every 30 seconds
5. If network unavailable: data persists locally, sync retries when online
6. Once backend acknowledges: `sync_status = 'SYNCED'`

The backend URL comes from `EXPO_PUBLIC_API_URL`. In production builds with no
URL configured, remote sync is safely disabled (see `src/config/env.ts`).

### Sync Payload
```typescript
{
  results: ChecklistResult[],      // Item inspection results (incl. severity)
  punchItems: PunchItem[],          // Auto-generated defect items
  instances: ChecklistInstance[],   // Completed checklists with signatures
  timestamp: string                 // ISO timestamp
}
```

### Management Alert Flow
HIGH-severity failures raise an `Alert`, shown locally via push and synced to
the backend, which fans the alert out to other managers' registered devices via
Expo push. See [backend/README.md](./backend/README.md) for the
`/api/devices` and `/api/alerts` endpoints.

## 🛠️ Development

### Adding New Templates
Templates can be created in-app, or seeded via `seedDatabase()` in
`src/database/db.ts`:

```typescript
// Example: Adding Electrical Rough-In template
const templateId = uuidv4();
await database.runAsync(
  `INSERT INTO templates (id, name, division, created_at)
   VALUES (?, ?, ?, ?)`,
  [templateId, 'Electrical Rough-In', 'Electrical', new Date().toISOString()]
);
```

### Backend Sync Client
The sync client lives in `src/services/sync.ts` and posts the `SyncPayload` to
`${API_BASE_URL}/api/sync`. The companion Express/PostgreSQL server lives under
[`backend/`](./backend).

### Custom Styling
- **Colors**: Edit `tailwind.config.js` `theme.colors.construction`
- **Typography**: Adjust `theme.fontSize` scale
- **Components**: Use NativeWind classNames (Tailwind for React Native)

## 🔐 Security & Production Considerations

The static demo login is for field testing only. Before production:

- [ ] Replace static accounts with backend-validated authentication (JWT/OAuth 2.0)
- [ ] Use HTTPS for all backend communication
- [ ] Encrypt sensitive data at rest (consider react-native-keychain)
- [ ] Implement photo upload to cloud object storage (S3/GCS)
- [ ] Implement conflict resolution for concurrent updates
- [ ] Keep backend input validation and rate limiting enabled (already present in `backend/`)

## 📱 Building for Production

This repo includes EAS configuration (`eas.json`) and local build guides:
- [BUILD-INSTRUCTIONS.md](./BUILD-INSTRUCTIONS.md)
- [APK-BUILD-GUIDE.md](./APK-BUILD-GUIDE.md)
- [LOCAL-BUILD-GUIDE.md](./LOCAL-BUILD-GUIDE.md)

### iOS
```bash
eas build --platform ios --profile production
```

### Android
```bash
eas build --platform android --profile production
```

## 🤝 Contributing

1. Create a feature branch from `main`
2. Make changes following the architecture guide
3. Run type checking and linting
4. Test on both iOS and Android simulators
5. Submit PR with clear description

## 📚 Additional Resources

- [Expo Documentation](https://docs.expo.dev)
- [React Native Docs](https://reactnative.dev)
- [SQLite (expo-sqlite)](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [Tailwind CSS](https://tailwindcss.com)
- [NativeWind](https://www.nativewind.dev)
- [Expo Router](https://docs.expo.dev/routing/introduction/)

## 📝 License

[Add appropriate license]

## 🐛 Known Limitations

- Photo uploads to remote object storage are tracked but require backend storage wiring (S3/GCS)
- Static demo accounts are not backend-validated
- No multi-user concurrent editing of the same checklist instance
- No real-time WebSocket updates (polling-based sync plus push alerts)

## 🚧 Roadmap

- [ ] Backend-validated user authentication
- [ ] Cloud photo storage integration
- [ ] Multi-language support
- [ ] Advanced filtering and search
- [ ] Punch list management screen
- [ ] Team collaboration features

## ✅ Next Steps

The fastest path from field-test build to a production-ready deployment:

1. **Stand up the backend** — Deploy `backend/` against a managed PostgreSQL
   instance, run `npm run migrate`, and set `EXPO_PUBLIC_API_URL` in the EAS
   build profile so devices sync to it.
2. **Replace demo auth** — Swap the static accounts in `src/auth/authContext.tsx`
   for backend-validated login (JWT), and store the token via the existing
   `getAuthToken()` hook in `src/config/env.ts`.
3. **Wire photo uploads** — Connect `src/services/photos.ts` to the backend's
   `/api/photos` endpoint and an object store (S3/GCS) so the
   `photo_sync_status` lifecycle completes (`PENDING → UPLOADED`).
4. **Configure push** — Register an Expo push project and set `EXPO_ACCESS_TOKEN`
   on the backend so cross-device management alerts deliver reliably.
5. **Add automated checks to CI** — Run `npm run type-check`, `npm run lint`,
   and `npm test` (plus the backend tests) on every PR.
6. **Cut a release build** — Follow [BUILD-INSTRUCTIONS.md](./BUILD-INSTRUCTIONS.md)
   to produce signed iOS/Android artifacts, then validate sync and alerts on
   real devices before distribution.
