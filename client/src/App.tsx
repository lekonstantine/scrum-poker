import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  History, 
  Send, 
  CheckCircle2, 
  XCircle,
  User as UserIcon,
  Crown,
  LogOut
} from 'lucide-react';

// --- Types ---
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

const CHARACTERS = [
  { name: 'Kons', title: 'iOS Developer', avatar: '📱' },
  { name: 'Jason', title: 'iOS Developer', avatar: '📱' },
  { name: 'Bharat', title: 'Web Developer', avatar: '💻' },
  { name: 'Munim', title: 'Web Developer', avatar: '💻' },
  { name: 'David', title: 'API Developer', avatar: '☁️' },
  { name: 'Fergal', title: 'API Developer', avatar: '☁️' },
  { name: 'Akash', title: 'Lead Developer', avatar: '🚀' },
  { name: 'Melody', title: 'Scrum Master', avatar: '📋' },
];

const VOTE_VALUES = ['1', '2', '3', '5', '8'];

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [shuffledChars] = useState(() => [...CHARACTERS].sort(() => Math.random() - 0.5));
  const [selectedChar, setSelectedChar] = useState<typeof CHARACTERS[0] | null>(null);
  const [roomState, setRoomState] = useState<{
    users: User[];
    currentTask: Task | null;
    isRevealed: boolean;
    history: HistoryEntry[];
  }>({
    users: [],
    currentTask: null,
    isRevealed: false,
    history: [],
  });
  const [jiraId, setJiraId] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    // If SOCKET_URL is / use current origin, otherwise use the env value
    const url = SOCKET_URL === '/' ? window.location.origin : SOCKET_URL;
    console.log('Connecting to socket at:', url);
    
    const newSocket = io(url, {
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });
    
    newSocket.on('connect', () => {
      console.log('Socket connected successfully!');
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
    });

    newSocket.on('state-update', (state) => {
      setRoomState(prev => ({ ...prev, ...state }));
    });

    newSocket.on('joined', (user) => {
      setCurrentUser(user);
    });

    newSocket.on('removed', () => {
      setCurrentUser(null);
      alert('You have been removed from the room.');
    });

    newSocket.on('error', (msg) => {
      alert(msg);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const handleJoin = () => {
    if (socket && selectedChar) {
      socket.emit('join', selectedChar);
    }
  };

  const handleVote = (value: string | null) => {
    if (socket) {
      socket.emit('vote', value);
    }
  };

  const handleReveal = () => {
    if (socket && currentUser?.isAdmin) {
      socket.emit('reveal');
    }
  };

  const handleReset = () => {
    if (socket && currentUser?.isAdmin) {
      socket.emit('reset');
    }
  };

  const handleSetTask = () => {
    if (!jiraId) return;
    if (socket) {
      socket.emit('set-task', {
        id: jiraId,
        title: jiraId,
        description: 'No description provided'
      });
      setJiraId('');
    }
  };

  const handleRemoveUser = (userId: string) => {
    if (socket && currentUser?.isAdmin) {
      if (confirm('Are you sure you want to remove this user?')) {
        socket.emit('remove-user', userId);
      }
    }
  };

  const handleLeave = () => {
    if (socket) {
      socket.emit('leave');
      setCurrentUser(null);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-slate-900">
        <h1 className="text-4xl font-bold mb-8 text-white">Choose Your Character</h1>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 max-w-5xl">
          {shuffledChars.map((char) => {
            const isTaken = roomState.users.some(u => u.name === char.name);
            return (
              <button
                key={char.name}
                onClick={() => !isTaken && setSelectedChar(char)}
                disabled={isTaken}
                className={`p-6 rounded-2xl border-4 transition-all flex flex-col items-center gap-3 ${
                  selectedChar?.name === char.name 
                  ? 'border-blue-500 bg-blue-500/10 scale-105' 
                  : isTaken 
                    ? 'border-slate-800 bg-slate-900 opacity-40 grayscale cursor-not-allowed'
                    : 'border-slate-700 bg-slate-800 hover:border-slate-500'
                }`}
              >
                <span className="text-5xl">{char.avatar}</span>
                <div className="text-center">
                  <p className="font-bold text-white text-lg">{char.name}</p>
                  <p className="text-sm text-slate-400">{isTaken ? 'Already in room' : char.title}</p>
                </div>
              </button>
            );
          })}
        </div>
        <button
          onClick={handleJoin}
          disabled={!selectedChar}
          className="mt-12 px-12 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xl font-bold rounded-full transition-colors shadow-lg shadow-blue-500/20"
        >
          Enter Room
        </button>
      </div>
    );
  }

  // Poker Room Layout
  const userInRoom = roomState.users.find(u => u.id === currentUser?.id) || currentUser;
  const latestHistory = roomState.history[roomState.history.length - 1];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 overflow-hidden flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
            <span className="text-2xl">{userInRoom.avatar}</span>
          </div>
          <div>
            <h2 className="font-bold flex items-center gap-2">
              {userInRoom.name} {userInRoom.isAdmin && <Crown className="w-4 h-4 text-yellow-400" />}
            </h2>
            <p className="text-xs text-slate-400">{userInRoom.title}</p>
          </div>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={() => setShowHistory(true)}
            className="p-3 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors border border-slate-700 text-slate-400 hover:text-white"
            title="History"
          >
            <History className="w-5 h-5" />
          </button>
          <button 
            onClick={handleLeave}
            className="p-3 bg-slate-800 rounded-xl hover:bg-red-600/20 text-slate-400 hover:text-red-400 transition-all border border-slate-700"
            title="Leave Room"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center relative">
        {/* The Table */}
        <div className="w-[800px] h-[400px] bg-slate-800 rounded-[200px] border-[12px] border-slate-700 shadow-2xl relative flex items-center justify-center -translate-y-16">
          <div className="text-center max-w-md p-8">
            {roomState.currentTask ? (
              <>
                <h4 className="text-2xl font-bold mb-4 line-clamp-2 flex items-center justify-center gap-3">
                  {roomState.currentTask.title}
                  {roomState.isRevealed && (
                    <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-lg">
                      {latestHistory ? latestHistory.average : '0.0'}
                    </span>
                  )}
                </h4>
              </>
            ) : (
              <p className="text-slate-500 text-xl italic">Waiting for Admin to start...</p>
            )}
          </div>

          {/* Seats */}
          {[...Array(10)].map((_, i) => {
            const angle = (i * 36) * (Math.PI / 180);
            const x = Math.cos(angle) * 440;
            const y = Math.sin(angle) * 240;
            const seatedUser = roomState.users.find(u => u.seatIndex === i);
            const revealedVote = roomState.isRevealed && latestHistory ? latestHistory.votes[seatedUser?.name || ''] : null;

            return (
              <div 
                key={i}
                className="absolute transition-all duration-500"
                style={{ transform: `translate(${x}px, ${y}px)` }}
              >
                {seatedUser ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-16 h-24 rounded-lg border-2 flex items-center justify-center text-2xl font-bold transition-all duration-500 ${
                      (roomState.isRevealed ? revealedVote : seatedUser.vote)
                        ? (roomState.isRevealed 
                            ? 'bg-blue-600 border-blue-400 scale-110 shadow-lg shadow-blue-500/50' 
                            : 'bg-indigo-900 border-indigo-500 shadow-md rotate-3') 
                        : 'bg-slate-900/50 border-slate-700/50'
                    }`}>
                      {roomState.isRevealed 
                        ? revealedVote 
                        : (seatedUser.vote ? (
                            <div className="w-full h-full flex items-center justify-center opacity-20">
                              <Crown className="w-8 h-8 rotate-12" />
                            </div>
                          ) : '')
                      }
                    </div>
                    <div className="bg-slate-900/90 backdrop-blur px-2 py-1 rounded-md border border-slate-700 text-xs whitespace-nowrap flex items-center gap-2">
                      {seatedUser.name}
                      {userInRoom.isAdmin && seatedUser.id !== userInRoom.id && (
                        <button
                          onClick={() => handleRemoveUser(seatedUser.id)}
                          className="hover:text-red-400 transition-colors"
                          title="Remove user"
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center text-slate-700">
                    <UserIcon className="w-6 h-6" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* Admin Panel */}
      {userInRoom.isAdmin && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-2xl flex gap-4 items-center">
          <div className="flex bg-slate-900 rounded-xl border border-slate-700 p-1">
            <input 
              type="text" 
              placeholder="Task Title (e.g. Jira ID)" 
              value={jiraId}
              onChange={(e) => setJiraId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSetTask()}
              className="bg-transparent px-4 py-2 outline-none w-48 text-sm"
            />
            <button 
              onClick={handleSetTask}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-blue-400"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <div className="h-8 w-[1px] bg-slate-700 mx-2" />
          <button 
            onClick={handleReveal}
            disabled={roomState.isRevealed}
            className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold flex items-center gap-2 transition-colors"
          >
            <CheckCircle2 className="w-5 h-5" /> Reveal
          </button>
          <button 
            onClick={handleReset}
            className="px-6 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/50 rounded-xl font-bold flex items-center gap-2 transition-colors"
          >
            <XCircle className="w-5 h-5" /> Reset
          </button>
        </div>
      )}

      {/* User Hand (Cards) */}
      {!userInRoom.isAdmin && (
        <div className="mt-8 flex justify-center gap-4">
          {VOTE_VALUES.map((val) => (
            <button
              key={val}
              onClick={() => handleVote(userInRoom.vote === val ? null : val)}
              className={`w-16 h-24 rounded-xl border-2 font-bold text-2xl transition-all hover:-translate-y-2 ${
                userInRoom.vote === val 
                ? 'bg-blue-600 border-blue-400 -translate-y-4 shadow-xl shadow-blue-500/50' 
                : 'bg-slate-800 border-slate-700 hover:border-slate-500'
              }`}
            >
              {val}
            </button>
          ))}
          <button
            onClick={() => handleVote(null)}
            className="ml-4 px-6 h-24 rounded-xl border-2 border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold transition-all flex flex-col items-center justify-center gap-1"
          >
            <XCircle className="w-6 h-6" />
            <span className="text-xs">Clear</span>
          </button>
        </div>
      )}

      {/* History Sidebar */}
      {showHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-md bg-slate-800 h-full shadow-2xl p-8 border-l border-slate-700 overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <History className="text-blue-400" /> Voting History
              </h2>
              <button 
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-slate-700 rounded-lg"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {roomState.history.length === 0 ? (
                <p className="text-slate-500 italic">No voting history yet.</p>
              ) : (
                roomState.history.slice().reverse().map((entry, idx) => (
                  <div key={idx} className="bg-slate-900 rounded-2xl p-6 border border-slate-700">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <h4 className="font-bold">{entry.task.title}</h4>
                        <span className="bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded text-xs font-bold border border-blue-500/30">
                          Avg: {entry.average}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(entry.votes).map(([name, vote]) => (
                        <div key={name} className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
                          <span className="text-xs font-medium">{name}:</span>
                          <span className="text-xs font-bold text-blue-400">{vote}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
