# Getting Started Guide

## System Requirements

- **Node.js**: v18.0.0 or later
- **npm**: v9.0.0 or later (or yarn/pnpm)
- **Expo CLI**: Latest version
- **Platform-specific**:
  - **iOS**: macOS 12+, Xcode 14+ (for building)
  - **Android**: Android SDK 31+ (for building)
  - **Web**: Modern browser with ES6+ support

## Initial Setup

### 1. Clone & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/arqua/quality-control-checklist.git
cd quality-control-checklist

# Install npm packages
npm install

# Verify installation
npm list expo react-native sqlite3
```

### 2. Environment Configuration

```bash
# Copy example environment file
cp .env.example .env.local

# Edit .env.local with your settings (optional)
# Default values work for local development
```

### 3. Verify Setup

```bash
# Check TypeScript compilation
npm run type-check

# Lint code
npm run lint
```

## Running the App

### Development Mode

```bash
npm start
```

This will open the Expo CLI menu:

```
› Press i to open iOS Simulator
› Press a to open Android Emulator
› Press w to open web preview
› Press r to reload
› Press m to toggle menu
› Press j to open debugger
› Press o to open project settings
› Press c to clear console
```

### iOS Simulator (macOS)

```bash
npm start
# Then press 'i'
# OR use directly:
npm run ios
```

The iOS Simulator should launch automatically with your app loaded.

### Android Emulator

```bash
# First, ensure Android Emulator is running
# (launch from Android Studio or command line)

npm start
# Then press 'a'
# OR use directly:
npm run android
```

### Physical Device

1. Install **Expo Go** app from App Store or Play Store
2. Run `npm start`
3. Scan the QR code with your device camera
4. Expo Go should open with your app

#### Troubleshooting Physical Device Connection
- Ensure phone and computer are on same WiFi network
- If QR code scanner doesn't work, copy the connection URL and paste in Expo Go
- Check firewall settings if connection fails

### Web Preview (Limited)

```bash
npm start
# Then press 'w'
# OR use directly:
npm run web
```

⚠️ **Note**: Web version has limited functionality (no camera, reduced storage). Use for UI preview only.

## Project Walkthrough

### 1. Home Screen (`app/(home)/index.tsx`)

**What it does**:
- Displays all available projects
- Shows active checklists for selected project
- Provides "New Checklist" button
- Manual sync trigger button

**To test**:
1. Launch app - should show "Downtown Office Tower" project
2. See 0 checklists (on first run)
3. Tap "New Checklist" button

### 2. New Checklist Screen (`app/(home)/new-checklist.tsx`)

**What it does**:
- Lists available QC templates grouped by division
- Collects inspector name
- Creates new checklist instance

**To test**:
1. From Home, tap "New Checklist"
2. Enter your name in inspector name field
3. Select "Pre-Pour Concrete" template
4. Tap "Create Checklist" button
5. Should navigate to inspection screen

### 3. Inspection Screen (`app/(inspection)/index.tsx`)

**What it does**:
- Displays all items from selected template
- Pass/Fail/N/A buttons for each item
- Comments and photo placeholders
- Progress tracking
- Sign-off functionality

**To test**:
1. From inspection screen, tap Pass/Fail/N/A buttons
2. Add comments to some items
3. Watch progress bar update
4. Once all items complete, "Sign Off & Complete" button enables
5. Tap to open signature modal
6. Submit sign-off

## Database & Seeding

### Viewing Local Data

The app uses SQLite stored on the device:
- **iOS Simulator**: `~/Library/Developer/CoreSimulator/Devices/[device-id]/data/Containers/Data/Application/[app-id]/Library/`
- **Android Emulator**: Use Android Studio Device File Explorer

### Inspecting Database

To check what's in the database, add debug logging to `src/hooks/useChecklist.ts`:

```typescript
useEffect(() => {
  loadChecklist();
  
  // Debug: Log all data
  db.getChecklistResultsByInstance(instanceId).then(results => {
    console.log('Checklist results:', results);
  });
}, [instanceId]);
```

Then check console output in Expo CLI.

### Resetting Database

To clear all local data and reseed:

```typescript
// Add to a debug screen or modify seedDatabase() to clear all tables:
const database = await getDatabase();
await database.execAsync('DELETE FROM checklist_results');
await database.execAsync('DELETE FROM punch_items');
await database.execAsync('DELETE FROM checklist_instances');
await database.execAsync('DELETE FROM template_items');
await database.execAsync('DELETE FROM templates');
await database.execAsync('DELETE FROM projects');
```

## Debugging & Development Tools

### React Native Debugger

1. Install [React Native Debugger](https://github.com/jhen0409/react-native-debugger)
2. Run app with `npm start`
3. Press `d` in Expo CLI menu to open debugger

### Expo DevTools

Accessible within the app by shaking device or pressing Ctrl+M (Android) / Cmd+D (iOS).

### Console Output

```bash
# View logs in Expo CLI terminal while app is running
npm start
# Logs will appear in the terminal
```

### TypeScript Errors

```bash
# Check for type errors without running
npm run type-check

# Fix auto-fixable issues
npm run lint -- --fix
```

## Common Tasks

### Adding a New Checklist Template

Edit `src/database/db.ts`, in the `seedDatabase()` function:

```typescript
// Add new template
const templateId = uuidv4();
await database.runAsync(
  `INSERT INTO templates (id, name, division, created_at)
   VALUES (?, ?, ?, ?)`,
  [templateId, 'New Template Name', 'Division Name', new Date().toISOString()]
);

// Add items
const items = [
  { description: 'First inspection item', order: 1 },
  { description: 'Second inspection item', order: 2 },
];

for (const item of items) {
  const itemId = uuidv4();
  await database.runAsync(
    `INSERT INTO template_items (id, template_id, description_text, sort_order)
     VALUES (?, ?, ?, ?)`,
    [itemId, templateId, item.description, item.order]
  );
}
```

### Modifying the Database Schema

Edit `src/database/db.ts` in the `initializeDatabase()` function. For existing apps:

1. Increase a migration version number in app state
2. Check version on startup
3. Run migrations if needed
4. Use `ALTER TABLE` statements for changes

Example:
```typescript
// Check if new column exists
const columns = await database.getAllAsync(
  `PRAGMA table_info(checklist_instances)`
);
const hasColumn = columns.some(c => c.name === 'new_column');

if (!hasColumn) {
  await database.execAsync(
    'ALTER TABLE checklist_instances ADD COLUMN new_column TEXT'
  );
}
```

### Adding Real Photo Capture

Currently uses a placeholder. To add actual camera:

```typescript
import * as ImagePicker from 'expo-image-picker';

// In component:
const pickImage = async () => {
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.7,
  });

  if (!result.cancelled) {
    await updateItemStatus(itemId, status, comments, result.uri);
  }
};
```

### Implementing Backend Sync

The stub is in `src/hooks/useChecklist.ts`:

```typescript
async function syncToBackend(payload: SyncPayload) {
  const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/sync`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`, // Add auth
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    if (response.status === 200 && response.data.synced) {
      return {
        resultIds: response.data.synced.resultIds,
        punchItemIds: response.data.synced.punchItemIds,
        instanceIds: response.data.synced.instanceIds,
      };
    }
  } catch (error) {
    console.error('Sync failed:', error);
  }

  return { resultIds: [], punchItemIds: [], instanceIds: [] };
}
```

## Testing Offline Functionality

### iOS Simulator
1. Run app in Xcode simulator
2. Simulator menu → Features → Network Link Conditioner
3. Select "Very Bad Network" or "No Connectivity"
4. Perform checklist operations
5. Disable network again
6. Should see "Syncing..." indicator when online
7. Operations persist offline ✓

### Android Emulator
1. Extended Controls (⋯ button)
2. "Cellular" tab
3. Set Network to "Disconnected"
4. Perform checklist operations
5. Change Network to "WiFi"
6. Should see sync activity
7. Operations persist offline ✓

## Troubleshooting

### "Module not found" errors
```bash
rm -rf node_modules
npm install
npm start
```

### "Cannot find database"
- Ensure `expo-sqlite` is installed: `npm install expo-sqlite`
- On Android, may need permissions in `app.json`
- Try clearing cache: `npm start -- --clear`

### App crashes on startup
- Check TypeScript errors: `npm run type-check`
- Look at Expo CLI console for error messages
- Verify package.json dependencies match versions

### Sync not working
- Confirm backend URL in `.env.local`: `EXPO_PUBLIC_BACKEND_URL`
- Check network connectivity (simulator or device)
- Inspect syncToBackend() function response
- Add logging to see payload content

### Styles not applying (NativeWind)
- Rebuild cache: `npm start -- --clear`
- Restart Expo CLI
- Verify tailwind.config.js content paths include all files
- Check babel.config.js includes nativewind preset

## Performance Tips

1. **Large Checklists**: For 100+ items, consider pagination
2. **Sync Frequency**: Adjust interval in `useChecklist.ts` (default 30s)
3. **Database Queries**: Add indices for frequently queried columns
4. **Memory**: Clear old photo URIs periodically
5. **Bundle Size**: Run `npx expo-duplicate-dependencies` to identify issues

## Next Steps

1. **Read [ARCHITECTURE.md](./ARCHITECTURE.md)** for deep dive into design
2. **Set up backend**: Choose Node.js/Express or FastAPI
3. **Implement authentication**: Add login screen
4. **Add real photos**: Integrate camera module
5. **Deploy**: Build and distribute via App Store/Play Store

## Getting Help

- **Expo Docs**: https://docs.expo.dev
- **GitHub Issues**: [Project repo issues]
- **Expo Slack**: https://slack.expo.dev
- **Stack Overflow**: Tag with `expo` and `react-native`

---

Happy coding! 🚀
