# Quality Control Checklist Mobile App

A cross-platform **offline-first** mobile application for construction site quality control inspections using React Native, Expo, and SQLite. Built for unreliable connectivity environments with automatic background synchronization.

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

# Copy environment configuration
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

### Running Tests & Quality Checks

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Run test suite (configure as needed)
npm test
```

## 📋 Features

### Core Functionality
- **Project Selection**: Switch between multiple active construction projects
- **Template-Based Checklists**: Pre-configured QC templates by division (Concrete Pouring, Framing, etc.)
- **Interactive Inspection**: Quick-action buttons (Pass/Fail/N/A) for each item
- **Comments & Notes**: Inline text fields for discrepancies and observations
- **Photo Attachments**: Placeholder for camera/gallery integration
- **Automated Issue Generation**: Failed items automatically create punch list entries
- **Digital Sign-Off**: Inspector and Project Manager signature capture

### Offline-First Architecture
- ✅ All operations work without internet connectivity
- ✅ Local SQLite database for all data storage
- ✅ Automatic background sync every 30 seconds when online
- ✅ Manual sync button for user control
- ✅ Sync status indicators in UI

### User Interface
- **High-Contrast Design**: Optimized for sunlight and dusty environments
- **Large Tactile Buttons**: Easy to use with gloved hands
- **Progress Tracking**: Real-time pass/fail/NA counts and percentage completion
- **Responsive Layout**: Adapts to phone and tablet screens
- **Dark Mode Ready**: Built with Tailwind CSS for theme flexibility

## 📁 Project Structure

```
qc-checklist/
├── app/                          # Expo Router navigation
│   ├── _layout.tsx              # Root layout
│   ├── (home)/                  # Home stack
│   │   ├── index.tsx            # Project selection & checklists list
│   │   └── new-checklist.tsx    # Template selection
│   └── (inspection)/             # Inspection stack
│       └── index.tsx            # Main checklist interface
│
├── src/
│   ├── database/
│   │   └── db.ts               # SQLite schema, initialization, CRUD ops
│   ├── hooks/
│   │   └── useChecklist.ts     # State management & sync queue
│   └── types/
│       └── database.ts         # TypeScript interfaces
│
├── ARCHITECTURE.md              # Detailed architecture & design docs
├── package.json
├── tsconfig.json
├── app.json                     # Expo config
└── tailwind.config.js          # Tailwind CSS (NativeWind)
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed documentation.

## 🗄️ Data Model

### SQLite Tables
- **projects**: Construction projects
- **templates**: Master QC checklists by division
- **template_items**: Individual inspection items
- **checklist_instances**: Active checklist instances tied to projects
- **checklist_results**: Pass/Fail/NA results for each item
- **punch_items**: Auto-generated defect items from failures

All tables support full offline-first sync with `sync_status` flags.

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
1. User performs inspection (updates item status, adds comments, attaches photos)
2. Data saved immediately to local SQLite
3. Items marked `sync_status = 'PENDING'`
4. Background sync thread attempts to send to backend every 30 seconds
5. If network unavailable: data persists locally, sync retries when online
6. Once backend acknowledges: `sync_status = 'SYNCED'`

### Sync Payload
```typescript
{
  results: ChecklistResult[],      // Item inspection results
  punchItems: PunchItem[],          // Auto-generated defect items
  instances: ChecklistInstance[],   // Completed checklists
  timestamp: string                 // ISO timestamp
}
```

## 🛠️ Development

### Adding New Templates
Edit `seedDatabase()` in `src/database/db.ts`:

```typescript
// Example: Adding Electrical Rough-In template
const templateId = uuidv4();
await database.runAsync(
  `INSERT INTO templates (id, name, division, created_at)
   VALUES (?, ?, ?, ?)`,
  [templateId, 'Electrical Rough-In', 'Electrical', new Date().toISOString()]
);

const items = [
  { description: 'Conduit alignment verified', order: 1 },
  { description: 'Wire gauge and color coding correct', order: 2 },
  // ... more items
];
```

### Extending the API
Backend stub is in `useChecklist.ts::syncToBackend()`:

```typescript
async function syncToBackend(payload: SyncPayload) {
  const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
  const response = await axios.post(`${BACKEND_URL}/api/sync`, payload);
  // Handle response, return synced IDs
}
```

### Custom Styling
- **Colors**: Edit `tailwind.config.js` `theme.colors.construction`
- **Typography**: Adjust `theme.fontSize` scale
- **Components**: Use NativeWind classNames (Tailwind for React Native)

## 🔐 Security & Production Considerations

- [ ] Implement authentication (OAuth 2.0 or bearer tokens)
- [ ] Use HTTPS for all backend communication
- [ ] Encrypt sensitive data at rest (consider react-native-keychain)
- [ ] Add user audit logging on backend
- [ ] Implement photo upload to cloud storage (S3/GCS)
- [ ] Validate all sync payloads on backend
- [ ] Implement conflict resolution for concurrent updates
- [ ] Add rate limiting to sync endpoint

## 📱 Building for Production

### iOS
```bash
eas build --platform ios --type production
# Follow prompts for signing certificates
```

### Android
```bash
eas build --platform android --type production
# Follow prompts for keystore configuration
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

- Photo capture is a placeholder component (no actual camera integration yet)
- Signature canvas uses a mock UI (could be enhanced with react-native-canvas)
- Backend API endpoints are stubbed (need to implement Node/FastAPI server)
- No multi-user concurrent editing (each user needs separate checklist instance)
- No real-time WebSocket updates (polling-based sync only)

## 🚧 Roadmap

- [ ] Camera integration for photo capture
- [ ] Real signature drawing canvas
- [ ] Backend API (Node.js/Express or FastAPI with PostgreSQL)
- [ ] User authentication and login screen
- [ ] Multi-language support
- [ ] Advanced filtering and search
- [ ] Punch list management screen
- [ ] PDF report generation
- [ ] Push notifications for checklist updates
- [ ] Team collaboration features
