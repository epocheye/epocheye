# User Settings API Integration

## Overview

This implementation integrates 4 user endpoints into the Settings and Profile screens with proper state management using React Context.

## API Endpoints Implemented

### 1. POST /api/user/avatar

- **Purpose**: Upload user avatar image
- **Implementation**: `uploadAvatar()` in `src/utils/api/user/Profile.ts`
- **UI**: Camera button on profile avatar in SettingsScreen
- **Package**: Uses `react-native-image-picker` for image selection

### 2. GET /api/user/profile

- **Purpose**: Fetch user profile data
- **Implementation**: `getUserProfile()` in `src/utils/api/user/Profile.ts`
- **Response**: Returns name, email, phone, avatar_url, preferences, created_at, last_login, uuid
- **UI**: Auto-loads on app start and displays in Settings and Profile screens

### 3. PUT /api/user/profile

- **Purpose**: Update user profile information
- **Implementation**: `updateUserProfile()` in `src/utils/api/user/Profile.ts`
- **Request Body**: name, phone, preferences (including notification settings)
- **UI**: "Save Changes" button appears in SettingsScreen when profile data is modified

### 4. GET /api/user/stats

- **Purpose**: Fetch user statistics (badges, challenges)
- **Implementation**: `getUserStats()` in `src/utils/api/user/Stats.ts`
- **Response**: badges count, total challenges, pending challenges, progress_by_status
- **UI**: Displays in Profile screen with stat cards

## File Structure

```
src/
├── utils/api/user/
│   ├── types.ts          # TypeScript interfaces for all user API types
│   ├── Profile.ts        # Profile and avatar API functions
│   ├── Stats.ts          # Stats API functions
│   └── index.ts          # Centralized exports
├── context/
│   ├── UserContext.tsx   # Global user state management
│   └── index.ts          # Updated to export UserContext
└── screens/Main/
    ├── SettingsScreen.tsx # Profile editing, avatar upload, preferences
    └── Profile.tsx        # User profile display with stats
```

## State Management

### UserContext

- **Location**: `src/context/UserContext.tsx`
- **Provider**: `<UserProvider>` wraps the app in `App.tsx`
- **Hook**: `useUser()` provides access to user state and actions

### Context State

```typescript
{
  profile: UserProfile | null,
  stats: UserStats | null,
  isLoading: boolean,
  isRefreshing: boolean,
  error: string | null,
  refreshUserData: () => Promise<void>,
  updateProfile: (data) => Promise<boolean>,
  uploadUserAvatar: (formData) => Promise<boolean>,
  clearUserData: () => void
}
```

## Features Implemented

### SettingsScreen Enhancements

1. **Real-time Profile Loading**: Fetches and displays actual user data from API
2. **Avatar Upload**: Click camera icon to select and upload new avatar
3. **Profile Editing**: Edit name, email, phone with change detection
4. **Save Changes Button**: Appears when profile data is modified
5. **Loading States**: Shows spinner while fetching/saving data
6. **Preferences Storage**: Saves notification settings to profile.preferences
7. **Error Handling**: Displays alerts for failed operations
8. **Logout Integration**: Clears user data on logout

### Profile Screen Enhancements

1. **User Info Display**: Shows name, email, avatar from profile
2. **Stats Cards**: Displays badges earned and total challenges
3. **Challenge Progress**: Shows pending challenges and progress by status
4. **Account Info**: Displays member since date and last login
5. **Loading State**: Shows spinner while data is loading
6. **Dynamic Data**: All data comes from API (no hardcoded values)

## Authentication Integration

### Token Management

- Uses existing `createAuthenticatedClient()` from auth module
- Automatically includes access token in all requests
- Handles token refresh on 401/403 responses
- Clears user data on logout

### Auto-initialization

- UserContext automatically fetches profile data on app start if user is authenticated
- No manual trigger needed after login
- Gracefully handles unauthenticated state

## Error Handling

### API Level

- Axios error handling with descriptive messages
- Network error detection (timeout, no connection)
- HTTP status code extraction
- Generic result type: `UserResult<T>` (success/error discriminated union)

### UI Level

- Alert dialogs for errors
- Loading spinners during async operations
- Disabled buttons during saving
- Graceful fallbacks for missing data

## Usage Examples

### Accessing User Data

```typescript
import { useUser } from '../../context';

function MyComponent() {
  const { profile, stats, isLoading } = useUser();

  if (isLoading) return <LoadingSpinner />;

  return <Text>{profile?.name}</Text>;
}
```

### Updating Profile

```typescript
const { updateProfile } = useUser();

const handleSave = async () => {
  const success = await updateProfile({
    name: 'New Name',
    phone: '+1234567890',
    preferences: { theme: 'dark' },
  });

  if (success) {
    Alert.alert('Success', 'Profile updated');
  }
};
```

### Uploading Avatar

```typescript
const { uploadUserAvatar } = useUser();

const handleUpload = async (imageUri: string) => {
  const formData = new FormData();
  formData.append('avatar', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'avatar.jpg',
  });

  const success = await uploadUserAvatar(formData);
};
```

## Dependencies Added

- `react-native-image-picker`: For avatar image selection

## Next Steps (Optional Enhancements)

1. **Image Caching**: Add caching for avatar images
2. **Optimistic Updates**: Update UI before API response
3. **Input Validation**: Add email/phone format validation
4. **Pull-to-Refresh**: Add refresh gesture to Profile screen
5. **Edit Mode**: Add explicit edit/view modes in Profile
6. **Stats Visualization**: Add charts for challenge progress
7. **Avatar Cropping**: Add image cropping before upload
8. **Preferences Screen**: Dedicated screen for all preferences
9. **Email Verification**: Add email verification flow
10. **Phone Verification**: Add SMS verification for phone numbers

## Notes

### Preferences Structure

The `preferences` field uses a flexible `Record<string, any>` type to accommodate:

- Notification settings (pushNotifications, emailNotifications)
- App preferences (locationServices)
- Security settings (twoFactorAuth)
- Onboarding data (location, tourismFrequency, interests)

### Avatar Upload Response

The POST /api/user/avatar endpoint returns generic properties (additionalProp1-3). After uploading:

1. The avatar upload completes
2. The profile is automatically refreshed via GET /api/user/profile
3. The new `avatar_url` is retrieved and displayed

### TypeScript Typing

All API responses and requests are fully typed with interfaces in `types.ts`. This ensures type safety throughout the codebase and provides IntelliSense support in VS Code.
