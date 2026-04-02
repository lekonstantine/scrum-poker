import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  History, 
  Send, 
  CheckCircle2, 
  XCircle,
  User as UserIcon,
  Crown,
  LogOut,
  Sun,
  Moon,
  Smile,
  MessageSquare,
  X,
  Copy,
  Check,
  Play,
  ChevronLeft
} from 'lucide-react';

// --- Types ---
interface User {
  id: string;
  name: string;
  title: string;
  avatar: string;
  seatIndex: number | null;
  vote: string | null;
  isAdmin: boolean;
  isObserver: boolean;
  reaction?: string | null;
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

interface ChatMessage {
  userName: string;
  text: string;
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
  { name: 'Gillian', title: 'Designer', avatar: '🎨' },
  { name: 'Adrian', title: 'Scrum Master', avatar: '📋' },
];

const VOTE_VALUES = ['1', '2', '3', '5', '8'];
const REACTIONS = [
  '👍', '❤️', '🔥', '👏', '🎉',
  '🤔', '👀', '😮', '🤯', '💯',
  '💀', '😭', '💅', '✨', '🗿',
  '🤝', '🙌', '🤡', '✅', '❌',
  '💨'
];

const JiraLinkWithCopy = ({ 
  jiraId, 
  originalText, 
  className, 
  onSetTask 
}: { 
  jiraId: string, 
  originalText: string, 
  className?: string, 
  onSetTask?: (id: string) => void 
}) => {
  const [copied, setCopied] = useState(false);
  const fullUrl = `https://cathaypacific-prod.atlassian.net/browse/${jiraId}`;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <span className="inline-flex items-center gap-1 group/jira">
      <a 
        href={fullUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={className || "text-blue-600 dark:text-blue-400 hover:underline"}
        onClick={(e) => e.stopPropagation()}
      >
        {jiraId}
      </a>
      <div className="flex items-center gap-0.5">
        <button
          onClick={handleCopy}
          className={`p-0.5 rounded transition-colors ${
            copied 
              ? 'text-green-500 bg-green-50 dark:bg-green-900/20' 
              : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
          title="Copy full URL"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
        {onSetTask && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSetTask(jiraId);
            }}
            className="p-0.5 rounded text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
            title="Start voting on this task"
          >
            <Play size={12} fill="currentColor" />
          </button>
        )}
      </div>
    </span>
  );
};

const renderJiraLinks = (text: string, linkClassName?: string, onSetTask?: (id: string) => void) => {
  // Regex for CTG-XXXX, CTGXXXX or standalone 3-4 digits
  const jiraRegex = /(CTG-?\d{3,4}|\b\d{3,4}\b)/g;
  const parts = text.split(jiraRegex);
  return parts.map((part, i) => {
    const match = part.match(/^(CTG-?)?(\d{3,4})$/);
    if (match) {
      const digits = match[2];
      const jiraId = `CTG-${digits}`;
      return (
        <JiraLinkWithCopy 
          key={i} 
          jiraId={jiraId} 
          originalText={part} 
          className={linkClassName} 
          onSetTask={onSetTask}
        />
      );
    }
    return part;
  });
};

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
    messages: ChatMessage[];
  }>({
    users: [],
    currentTask: null,
    isRevealed: false,
    history: [],
    messages: [],
  });
  const [jiraId, setJiraId] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showChatReactions, setShowChatReactions] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState<{[key: string]: number}>({});
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (chatRef.current && !chatRef.current.contains(event.target as Node)) {
        setShowChat(false);
      }
    }
    if (showChat) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showChat]);

  const [scale, setScale] = useState(1);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme') as 'light' | 'dark';
      if (saved) return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleResize = () => {
      const minWidth = 1100; // Desired width for full table layout
      const minHeight = 800; // Desired height for full table layout
      const scaleX = window.innerWidth / minWidth;
      const scaleY = (window.innerHeight - 300) / (minHeight - 300); // 300 for UI overhead
      setScale(Math.min(1, scaleX, scaleY));
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const url = SOCKET_URL === '/' ? window.location.origin : SOCKET_URL;
    const newSocket = io(url, {
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });
    
    newSocket.on('state-update', (state) => {
      setRoomState(prev => ({ ...prev, ...state }));
    });

    newSocket.on('joined', (user) => {
      setCurrentUser(user);
    });

    newSocket.on('removed', () => {
      setCurrentUser(null);
    });

    newSocket.on('error', (msg) => {
      alert(msg);
    });

    newSocket.on('user-typing', ({ userName }: { userName: string }) => {
      setTypingUsers(prev => ({
        ...prev,
        [userName]: Date.now()
      }));
    });

    setSocket(newSocket);
    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    // Clean up typing users who are no longer in the room
    setTypingUsers(prev => {
      const next = { ...prev };
      let changed = false;
      Object.keys(next).forEach(userName => {
        if (!roomState.users.some(u => u.name === userName)) {
          delete next[userName];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [roomState.users]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(userName => {
          if (now - next[userName] > 4000) {
            delete next[userName];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
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

  const handleReaction = (emoji: string) => {
    if (socket) {
      socket.emit('reaction', emoji);
    }
  };

  const handleChangeSeat = (seatIndex: number) => {
    if (socket && userInRoom && !userInRoom.isObserver && !userInRoom.isAdmin) {
      socket.emit('change-seat', seatIndex);
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
    if (!jiraId.trim()) return;
    if (socket) {
      socket.emit('set-task', {
        id: jiraId.trim(),
        title: jiraId.trim(),
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

  const handleSendMessage = () => {
    if (socket && chatMessage.trim()) {
      socket.emit('message', chatMessage.trim());
      setChatMessage('');
    }
  };

  const handleQuickSetTask = (id: string) => {
    if (socket && currentUser?.isAdmin) {
      socket.emit('set-task', {
        id: id,
        title: id,
        description: 'Set via quick action'
      });
      setShowChat(false);
      setShowHistory(false);
    }
  };

  const [lastTypingEmit, setLastTypingEmit] = useState(0);

  const handleTyping = () => {
    const now = Date.now();
    if (socket && now - lastTypingEmit > 2000) {
      socket.emit('typing');
      setLastTypingEmit(now);
    }
  };

  const handleLeave = () => {
    if (socket) {
      socket.emit('leave');
      setCurrentUser(null);
    }
  };

  const userInRoom = roomState.users.find(u => u.id === currentUser?.id) || currentUser;
  const observers = roomState.users.filter(u => u.isObserver);
  const scrumMasters = roomState.users.filter(u => u.isAdmin);
  const latestHistory = roomState.history[roomState.history.length - 1];
  const lastChatMessage = roomState.messages[roomState.messages.length - 1];

  const getTypingText = () => {
    const names = Object.keys(typingUsers);
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} is typing...`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
    if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]} are typing...`;
    return 'Several people are typing...';
  };

  if (!currentUser) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-8 transition-colors duration-300 ${theme} ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}`}>
        <button 
          onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
          className="fixed top-8 right-8 p-3 rounded-full bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:scale-110 transition-transform z-50"
        >
          {theme === 'dark' ? <Sun size={24} /> : <Moon size={24} />}
        </button>
        <h1 className="text-4xl font-bold mb-8 text-slate-800 dark:text-white">Choose Your Character</h1>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 max-w-5xl">
          {shuffledChars.map((char) => {
            const isTaken = roomState.users.some(u => u.name === char.name);
            return (
              <button
                key={char.name}
                onClick={() => !isTaken && setSelectedChar(char)}
                onDoubleClick={() => {
                  if (!isTaken) {
                    setSelectedChar(char);
                    socket?.emit('join', char);
                  }
                }}
                disabled={isTaken}
                className={`p-6 rounded-2xl border-4 transition-all flex flex-col items-center gap-3 ${
                  selectedChar?.name === char.name 
                  ? 'border-blue-500 bg-blue-500/10 scale-105 shadow-xl shadow-blue-500/20' 
                  : isTaken 
                    ? 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 opacity-40 grayscale cursor-not-allowed'
                    : 'border-white dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-500 shadow-md'
                }`}
              >
                <span className="text-5xl">{char.avatar}</span>
                <div className="text-center">
                  <p className="font-bold text-slate-800 dark:text-white text-lg">{char.name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{isTaken ? 'Already in room' : char.title}</p>
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-12 flex flex-col items-center gap-6">
          <button
            onClick={handleJoin}
            disabled={!selectedChar}
            className="px-16 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xl font-bold rounded-full transition-all shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95"
          >
            Enter Room
          </button>
          <button
            onClick={() => {
              const name = `Guest ${Math.floor(Math.random() * 1000)}`;
              socket?.emit('join', {
                name: name,
                title: 'Observer',
                avatar: '👀',
                isObserver: true
              });
            }}
            className="text-slate-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 font-medium transition-colors"
          >
            Join as Guest
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-6 overflow-hidden flex flex-col transition-colors duration-300 ${theme} ${theme === 'dark' ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleLeave}
            className="p-3 bg-white dark:bg-slate-800 rounded-xl hover:bg-red-50 dark:hover:bg-red-600/20 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-all border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-1 group/back"
            title="Leave Room"
          >
            <ChevronLeft className="w-5 h-5 group-hover/back:-translate-x-0.5 transition-transform" />
          </button>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{userInRoom?.avatar}</span>
            <div className="flex flex-col">
              <h2 className="font-bold flex items-center gap-2 text-lg leading-tight">
                {userInRoom?.name} {userInRoom?.isAdmin && <Crown className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />}
                {userInRoom?.isObserver && <span className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-500 dark:text-slate-400 ml-1">Observer</span>}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{userInRoom?.title}</p>
            </div>
          </div>
        </div>

        {/* Roles Panel: Scrum Masters & Observers */}
        <div className="flex items-center gap-3">
          {scrumMasters.length > 0 && (
            <div className="flex items-center gap-2 bg-white/50 dark:bg-slate-800/50 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700/50 shadow-sm backdrop-blur-md">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mr-1">Scrum Master</span>
              <div className="flex -space-x-2">
                {scrumMasters.map((sm) => (
                  <div key={sm.id} className="relative group/sm">
                    {sm.reaction && (
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 text-3xl animate-bounce pointer-events-none z-[100] drop-shadow-xl">
                        {sm.reaction}
                      </div>
                    )}
                    <div
                      className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 border-2 border-yellow-400 flex items-center justify-center text-lg shadow-lg hover:z-10 transition-all transform hover:scale-110"
                      title={`${sm.name} (Scrum Master)`}
                    >
                      {sm.avatar}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {observers.length > 0 && (
            <div className="flex items-center gap-2 bg-white/50 dark:bg-slate-800/50 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700/50 shadow-sm backdrop-blur-md">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mr-2">Observers</span>
              <div className="flex -space-x-2">
                {observers.map((obs) => (
                  <div 
                    key={obs.id} 
                    className="relative"
                  >
                    {obs.reaction && (
                      <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 text-3xl animate-bounce pointer-events-none z-[100] drop-shadow-xl">
                        {obs.reaction}
                      </div>
                    )}
                    <div 
                      className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-900 flex items-center justify-center text-lg shadow-lg hover:scale-110 transition-transform cursor-help"
                      title={`${obs.name} (Observer)`}
                    >
                      {obs.avatar}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <button 
            onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            className="p-3 bg-white dark:bg-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-white shadow-sm"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button 
            onClick={() => setShowHistory(true)}
            className="p-3 bg-white dark:bg-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-white shadow-sm"
            title="History"
          >
            <History className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center relative">
        <div 
          className="transition-transform duration-300 flex items-center justify-center z-10"
          style={{ transform: `scale(${scale})` }}
        >
          {/* The Table */}
          <div className="w-[800px] h-[400px] bg-white dark:bg-slate-800 rounded-[200px] border-[12px] border-slate-100 dark:border-slate-700 shadow-2xl relative flex items-center justify-center transition-colors">
            <div className="text-center max-w-md p-8">
              {roomState.currentTask ? (
                <>
                  <h4 className="text-2xl font-bold mb-4 line-clamp-2 flex items-center justify-center gap-3 text-slate-800 dark:text-white">
                    {renderJiraLinks(roomState.currentTask.title)}
                    {roomState.isRevealed && (
                      <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-lg shadow-lg">
                        {latestHistory ? latestHistory.average : '0.0'}
                      </span>
                    )}
                  </h4>
                </>
              ) : (
                <p className="text-slate-400 dark:text-slate-500 text-xl italic font-medium">Waiting for Admin to start...</p>
              )}
            </div>

            {/* Seats */}
            {[...Array(10)].map((_, i) => {
              const angle = (i * 36) * (Math.PI / 180);
              const x = Math.cos(angle) * 440;
              const y = Math.sin(angle) * 240;
              const seatedUser = roomState.users.find(u => u.seatIndex === i);
              const revealedVote = roomState.isRevealed && latestHistory ? latestHistory.votes[seatedUser?.name || ''] : null;

              // When the whole table scales down, we keep users a bit larger
              // this ensures names and cards remain readable
              const uiScale = scale < 0.8 ? 0.8 / scale : 1;

              return (
                <div 
                  key={i}
                  className="absolute transition-all duration-500"
                  style={{ transform: `translate(${x}px, ${y}px) scale(${uiScale})` }}
                >
                  {seatedUser ? (
                    <div className="flex flex-col items-center gap-2 relative">
                      {/* Reaction Overlay */}
                      {seatedUser.reaction && (
                        <div className="absolute -top-16 left-1/2 -translate-x-1/2 text-5xl animate-bounce pointer-events-none z-[100] drop-shadow-2xl">
                          {seatedUser.reaction}
                        </div>
                      )}
                      <div className={`w-16 h-24 rounded-lg border-2 flex items-center justify-center text-2xl font-bold transition-all duration-500 ${
                        (roomState.isRevealed ? revealedVote : seatedUser.vote)
                          ? (roomState.isRevealed 
                              ? 'bg-blue-600 border-blue-400 scale-110 shadow-lg shadow-blue-500/50 text-white' 
                              : 'bg-indigo-700 dark:bg-slate-600 border-indigo-500 dark:border-slate-400 shadow-md rotate-3 text-white') 
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600'
                      }`}>
                        {roomState.isRevealed 
                          ? revealedVote 
                          : (seatedUser.vote ? (
                              <div className="w-full h-full flex items-center justify-center opacity-40">
                                <Crown className="w-8 h-8 rotate-12" />
                              </div>
                            ) : '')
                        }
                      </div>
                      <div className={`backdrop-blur px-3 py-1.5 rounded-lg border text-base whitespace-nowrap flex items-center gap-2 transition-colors shadow-sm ${
                        seatedUser.id === userInRoom?.id 
                          ? 'bg-blue-600/20 dark:bg-blue-600/30 border-blue-500/50 text-blue-700 dark:text-blue-200 font-bold' 
                          : 'bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-100'
                      }`}>
                        <span>{seatedUser.name}</span>
                        {userInRoom?.isAdmin && seatedUser.id !== userInRoom.id && (
                          <button
                            onClick={() => handleRemoveUser(seatedUser.id)}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                            title="Remove user"
                          >
                            <XCircle className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => !userInRoom?.isObserver && !userInRoom?.isAdmin && handleChangeSeat(i)}
                      disabled={userInRoom?.isObserver || userInRoom?.isAdmin}
                      className={`w-12 h-12 rounded-full border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-300 dark:text-slate-700 transition-colors group ${
                        userInRoom?.isObserver || userInRoom?.isAdmin ? 'cursor-not-allowed opacity-40' : 'hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-400 dark:hover:text-slate-500 bg-white/50 dark:bg-transparent'
                      }`}
                    >
                      <UserIcon className={`w-6 h-6 ${(!userInRoom?.isObserver && !userInRoom?.isAdmin) ? 'group-hover:scale-110' : 'opacity-20'} transition-transform`} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Floating Reactions Button */}
      {userInRoom && (
        <div className="fixed right-8 top-28 flex flex-col items-end gap-2 z-40">
          <button
            onClick={() => setShowReactions(!showReactions)}
            className={`p-3 rounded-full shadow-lg border transition-all hover:scale-110 ${
              showReactions 
                ? 'bg-blue-600 border-blue-500 text-white' 
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-white shadow-sm'
            }`}
            title="Reactions"
          >
            <Smile size={24} />
          </button>
          {showReactions && (
            <div className="grid grid-cols-5 gap-2 bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl transition-all animate-in slide-in-from-top-2 fade-in duration-200">
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    handleReaction(emoji);
                    setShowReactions(false);
                  }}
                  className="w-10 h-10 flex items-center justify-center text-2xl hover:scale-125 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Controls Area */}
      <footer className="mt-auto pb-10 flex flex-col items-center gap-6">
        {/* Admin Panel */}
        <div className="h-[80px] flex items-center justify-center">
          {userInRoom?.isAdmin && (
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl flex gap-4 items-center animate-in fade-in zoom-in duration-300">
              {!roomState.currentTask ? (
                <div className="flex bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-1">
                  <input 
                    type="text" 
                    placeholder="Enter Task or Jira ID..." 
                    value={jiraId}
                    onChange={(e) => setJiraId(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSetTask()}
                    className="bg-transparent px-4 py-2 outline-none w-64 text-sm text-slate-800 dark:text-white placeholder-slate-400"
                  />
                  <button 
                    onClick={handleSetTask}
                    disabled={!jiraId.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2 font-bold text-sm"
                  >
                    <Send className="w-4 h-4" /> Start Voting
                  </button>
                </div>
              ) : (
                <div className="flex gap-4 items-center">
                  <div className="px-4 py-2 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-500 dark:text-slate-400 max-w-xs truncate">
                    Topic: <span className="text-slate-800 dark:text-white font-bold ml-1">{renderJiraLinks(roomState.currentTask.title)}</span>
                  </div>
                  <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-700 mx-2" />
                  <button 
                    onClick={handleReveal}
                    disabled={roomState.isRevealed}
                    className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center gap-2 transition-colors shadow-lg shadow-green-500/20"
                  >
                    <CheckCircle2 className="w-5 h-5" /> Reveal
                  </button>
                  <button 
                    onClick={handleReset}
                    className="px-6 py-2 bg-red-100 dark:bg-red-600/20 hover:bg-red-200 dark:hover:bg-red-600/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-600/50 rounded-xl font-bold flex items-center gap-2 transition-colors"
                  >
                    <XCircle className="w-5 h-5" /> Reset / New Task
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {!userInRoom?.isAdmin && !userInRoom?.isObserver && (
          <div className="flex flex-col items-center justify-center h-[140px] w-full px-4">
            {roomState.currentTask ? (
              <div className="flex flex-wrap justify-center gap-3 sm:gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {VOTE_VALUES.map((val) => (
                  <button
                    key={val}
                    onClick={() => handleVote(userInRoom?.vote === val ? null : val)}
                    className={`w-14 h-20 sm:w-16 sm:h-24 rounded-xl border-2 font-bold text-xl sm:text-2xl transition-all hover:-translate-y-2 ${
                      userInRoom?.vote === val 
                      ? 'bg-blue-600 border-blue-400 -translate-y-4 shadow-xl shadow-blue-500/50 text-white' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white hover:border-blue-300 dark:hover:border-slate-500 shadow-md'
                    }`}
                  >
                    {val}
                  </button>
                ))}
                <button
                  onClick={() => handleVote(null)}
                  className="px-4 sm:px-6 h-20 sm:h-24 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 font-bold transition-all flex flex-col items-center justify-center gap-1 shadow-md"
                >
                  <XCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="text-[10px] sm:text-xs">Clear</span>
                </button>
              </div>
            ) : (
              <div className="bg-white/50 dark:bg-slate-800/50 px-8 py-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500 italic flex items-center gap-3">
                <Smile className="w-5 h-5 opacity-50 text-blue-500" />
                Wait for the Scrum Master to start voting...
              </div>
            )}
          </div>
        )}
      </footer>

      {showHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 h-full shadow-2xl p-8 border-l border-slate-200 dark:border-slate-700 overflow-y-auto transition-colors">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold flex items-center gap-3 text-slate-800 dark:text-white">
                <History className="text-blue-500 dark:text-blue-400" /> Voting History
              </h2>
              <button 
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {roomState.history.length === 0 ? (
                <p className="text-slate-400 italic">No voting history yet.</p>
              ) : (
                roomState.history.slice().reverse().map((entry, idx) => (
                  <div key={idx} className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <h4 className="font-bold text-slate-800 dark:text-white">
                          {renderJiraLinks(entry.task.title, undefined, userInRoom?.isAdmin ? handleQuickSetTask : undefined)}
                        </h4>
                        <span className="bg-blue-100 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded text-xs font-bold border border-blue-200 dark:border-blue-500/30">
                          Avg: {entry.average}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(entry.votes).map(([name, vote]) => (
                        <div key={name} className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{name}:</span>
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{vote}</span>
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

      {/* Chat Component */}
      <div ref={chatRef} className="fixed bottom-8 left-8 z-50 flex flex-col items-start gap-3">
        {showChat && (
          <div className="w-80 h-[450px] bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                <MessageSquare className="w-4 h-4 text-blue-500" /> Chat
              </h3>
              <button 
                onClick={() => setShowChat(false)}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {roomState.messages.length === 0 ? (
                <p className="text-center text-slate-400 text-sm mt-10 italic">No messages yet. Say hi!</p>
              ) : (
                roomState.messages.map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.userName === userInRoom?.name ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{msg.userName}</span>
                      <span className="text-[10px] text-slate-400">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className={`px-3 py-2 rounded-2xl max-w-[90%] break-words shadow-sm ${
                      REACTIONS.includes(msg.text.trim()) ? 'text-3xl bg-transparent !border-0 !shadow-none' : 'text-sm'
                    } ${
                      msg.userName === userInRoom?.name 
                        ? 'bg-blue-600 text-white rounded-tr-none' 
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200 dark:border-slate-600'
                    }`}>
                      {REACTIONS.includes(msg.text.trim()) ? msg.text : renderJiraLinks(
                        msg.text, 
                        msg.userName === userInRoom?.name ? "text-white underline" : undefined,
                        userInRoom?.isAdmin ? handleQuickSetTask : undefined
                      )}
                    </div>
                  </div>
                ))
              )}
              {getTypingText() && (
                <div className="flex items-center gap-2 text-slate-400 italic text-xs animate-pulse ml-2 pb-2">
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce"></div>
                  </div>
                  {getTypingText()}
                </div>
              )}
              {/* Scroll anchor */}
              <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth' })} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 relative">
              {showChatReactions && (
                <div className="absolute bottom-full left-4 mb-2 grid grid-cols-5 gap-1 bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-200 z-50">
                  {REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        if (socket) {
                          socket.emit('message', emoji);
                        }
                        setShowChatReactions(false);
                      }}
                      className="w-10 h-10 flex items-center justify-center text-2xl hover:scale-125 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-all"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowChatReactions(!showChatReactions)}
                  className={`p-2 rounded-xl transition-colors ${
                    showChatReactions 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-blue-500'
                  }`}
                >
                  <Smile className="w-4 h-4" />
                </button>
                <input 
                  type="text" 
                  value={chatMessage}
                  onChange={(e) => {
                    setChatMessage(e.target.value);
                    handleTyping();
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors text-slate-800 dark:text-white"
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={!chatMessage.trim()}
                  className="p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {!showChat && (
          <button 
            onClick={() => setShowChat(true)}
            className="group flex items-center gap-3 bg-white dark:bg-slate-800 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl hover:scale-105 transition-all max-w-[280px]"
          >
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left overflow-hidden">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Chat</p>
              <p className="text-sm text-slate-800 dark:text-slate-200 truncate font-medium">
                {lastChatMessage ? (
                  <>
                    <span className="font-bold text-blue-500 dark:text-blue-400">{lastChatMessage.userName}:</span> {lastChatMessage.text}
                  </>
                ) : 'Click to open chat'}
              </p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
