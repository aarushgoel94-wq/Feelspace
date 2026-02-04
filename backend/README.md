# Let It Out Backend API

Node.js/Express backend API server for the Let It Out mobile app.

## Features

- RESTful API for vents, comments, reactions, and rooms
- SQLite database for easy setup (no external database required)
- CORS enabled for mobile app access
- Automatic database initialization with default rooms
- Full CRUD operations for all entities

## Setup

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

3. **Server runs on:** `http://localhost:3000`

## API Endpoints

### Rooms
- `GET /rooms` - Get all rooms

### Vents
- `GET /vents?limit=50&offset=0&roomId=optional` - Get vents (with optional room filter)
- `GET /vents/:id` - Get single vent
- `POST /vents` - Create a vent

### Comments
- `GET /comments/vent/:ventId` - Get comments for a vent
- `POST /comments` - Create a comment

### Reactions
- `GET /reactions/vent/:ventId` - Get all reactions for a vent
- `GET /reactions/vent/:ventId/counts` - Get reaction counts
- `POST /reactions` - Create/toggle a reaction (returns null if toggled off)

### Reports (Optional)
- `POST /reports` - Create a report

### Analytics (Optional)
- `POST /analytics/track` - Track an analytics event
- `GET /analytics/metrics` - Get analytics metrics

## Database

The backend uses SQLite, which creates a `database.db` file automatically on first run. The database is initialized with default rooms if none exist.

### Database Schema

- **rooms**: id, name, description, createdAt
- **vents**: id, roomId, text, anonymousHandle, deviceId, moodBefore, moodAfter, createdAt
- **comments**: id, ventId, text, anonymousHandle, createdAt
- **reactions**: id, ventId, type, anonymousHandle, deviceId, createdAt
- **reports**: id, ventId, reason, description, deviceId, createdAt

## Configuration

Set the port via environment variable:
```bash
PORT=3000 npm start
```

## Connecting the App

1. Update your `.env` file in the root of the mobile app:
   ```
   EXPO_PUBLIC_API_URL=http://localhost:3000
   ```

2. For iOS Simulator, use `http://localhost:3000`
3. For physical device, use your computer's IP: `http://192.168.x.x:3000`

## Production Deployment

For production:
1. Use a more robust database (PostgreSQL, MySQL, etc.)
2. Add authentication/authorization
3. Add rate limiting
4. Add request validation middleware
5. Set up proper logging
6. Configure CORS properly for your domain
7. Use environment variables for configuration

## Notes

- All data is anonymous - no user accounts required
- Reactions are unique per device (one reaction per type per device per vent)
- Comments and reactions are cascade deleted when a vent is deleted
- The database is automatically initialized with default rooms on first run






