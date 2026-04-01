# Scrum Poker App

A real-time Scrum Poker application for development teams.

## Features
- **Character Selection:** Choose from 10 unique team members.
- **Real-time Interaction:** Automatic seating at a virtual table.
- **Voting:** Story point selection (1, 2, 3, 5, 8).
- **Admin Controls:** Start voting, reveal cards, and manage Jira tasks.
- **Jira Integration:** Fetch story details via Jira ID (requires credentials).
- **Voting History:** View previous session results.

## How to Run

### 1. Start the Server
```bash
cd server
npm install
npm run dev
```

### 2. Start the Client
```bash
cd client
npm install
npm run dev
```

### 3. (Optional) Configure Jira
Edit `server/.env` and add your Jira credentials to enable real-time task fetching.

### 4. External Access (Localtunnel)
To let your team connect from outside your network:
```bash
npx localtunnel --port 5173
```
*Note: You may need to update `client/.env`'s `VITE_SOCKET_URL` if the server is also exposed via a tunnel.*

## Local Network Access
Your team can also connect via your Mac's local IP address (e.g., `http://192.168.1.50:5173`).
