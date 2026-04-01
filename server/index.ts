import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

interface User {
  id: string;
  name: string;
  title: string;
  avatar: string;
  seatIndex: number;
  vote: string | null;
  isAdmin: boolean;
}

interface Task {
  id: string;
  title: string;
  description: string;
}

interface HistoryEntry {
  task: Task;
  votes: { [userName: string]: string };
  average: number;
  timestamp: number;
}

let users: User[] = [];
let currentTask: Task | null = null;
let isRevealed = false;
let history: HistoryEntry[] = [];

const MAX_SEATS = 10;

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Send initial state to the new connection
  socket.emit('state-update', { users, currentTask, isRevealed, history });

  socket.on('join', (userData: { name: string; title: string; avatar: string }) => {
    if (users.some(u => u.name === userData.name)) {
      socket.emit('error', 'Этот персонаж уже занят');
      return;
    }
    
    const availableSeats = Array.from({ length: MAX_SEATS }, (_, i) => i)
      .filter(seat => !users.some(u => u.seatIndex === seat));

    if (availableSeats.length === 0) {
      socket.emit('error', 'No seats available');
      return;
    }

    const newUser: User = {
      id: socket.id,
      ...userData,
      seatIndex: availableSeats[0]!,
      vote: null,
      isAdmin: userData.name === 'Melody', // Only Melody is admin
    };

    users.push(newUser);
    io.emit('state-update', { users, currentTask, isRevealed, history });
    socket.emit('joined', newUser);
  });

  socket.on('vote', (vote: string | null) => {
    const user = users.find(u => u.id === socket.id);
    if (user) {
      user.vote = vote;
      io.emit('state-update', { users, currentTask, isRevealed, history });
    }
  });

  socket.on('reveal', () => {
    const admin = users.find(u => u.id === socket.id && u.isAdmin);
    if (admin) {
      isRevealed = true;
      if (currentTask) {
        const votes: { [userName: string]: string } = {};
        let sum = 0;
        let count = 0;
        users.forEach(u => {
          if (u.vote) {
            votes[u.name] = u.vote;
            const val = parseFloat(u.vote);
            if (!isNaN(val)) {
              sum += val;
              count++;
            }
          }
        });
        const average = count > 0 ? Number((sum / count).toFixed(1)) : 0;
        history.push({ task: { ...currentTask }, votes, average, timestamp: Date.now() });
      }
      users.forEach(u => u.vote = null);
      io.emit('state-update', { users, currentTask, isRevealed, history });
    }
  });

  socket.on('reset', () => {
    const admin = users.find(u => u.id === socket.id && u.isAdmin);
    if (admin) {
      isRevealed = false;
      currentTask = null;
      users.forEach(u => u.vote = null);
      io.emit('state-update', { users, currentTask, isRevealed });
    }
  });

  socket.on('set-task', (task: Task | null) => {
    const admin = users.find(u => u.id === socket.id && u.isAdmin);
    console.log(`Setting task: ${task?.id}, requested by: ${admin?.name || 'unknown'}`);
    if (admin) {
      currentTask = task;
      isRevealed = false;
      users.forEach(u => u.vote = null);
      io.emit('state-update', { users, currentTask, isRevealed });
    }
  });

  socket.on('remove-user', (userId: string) => {
    const admin = users.find(u => u.id === socket.id && u.isAdmin);
    if (admin) {
      const userToRemove = users.find(u => u.id === userId);
      if (userToRemove) {
        users = users.filter(u => u.id !== userId);
        io.to(userId).emit('removed');
        io.emit('state-update', { users, currentTask, isRevealed });
      }
    }
  });

  socket.on('leave', () => {
    users = users.filter(u => u.id !== socket.id);
    io.emit('state-update', { users, currentTask, isRevealed });
  });

  socket.on('disconnect', () => {
    users = users.filter(u => u.id !== socket.id);
    io.emit('state-update', { users, currentTask, isRevealed });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
