
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import type { Song, Playlist, Comment, ProducerProfile } from './types';
import { FileUpload } from './components/FileUpload';
import { ShareModal } from './components/ShareModal';
import { 
  PlayIcon, PauseIcon, PlusIcon, TrashIcon, ShareIcon, 
  ChevronUpIcon, ChevronDownIcon, LoadingSpinnerIcon, AnalyzeIcon,
  SaveIcon, CommentIcon, ClipboardIcon, CheckIcon, LockClosedIcon,
  UserCircleIcon, LinkIcon, ExportIcon, EditIcon
} from './components/Icons';

const formatTime = (seconds: number) => {
  const floorSeconds = Math.floor(seconds);
  const minutes = Math.floor(floorSeconds / 60);
  const remainingSeconds = floorSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

interface EditFormData {
    name?: string;
    bpm?: string;
    key?: string;
    genre?: string;
    mood?: string;
    instrumentation?: string;
    genreTags?: string;
}

const App: React.FC = () => {
  const [uploadedSongs, setUploadedSongs] = useState<Song[]>([]);
  const [playlist, setPlaylist] = useState<Playlist>({ id: `playlist-${Date.now()}`, name: "Untitled Playlist", songs: [] });
  const [savedPlaylists, setSavedPlaylists] = useState<Playlist[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isShareModalOpen, setShareModalOpen] = useState(false);
  const [isViewerMode, setIsViewerMode] = useState(false);
  const [isLinkExpired, setIsLinkExpired] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [expandedSongId, setExpandedSongId] = useState<string | null>(null);
  const [isFeedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [passwordProtectedPlaylist, setPasswordProtectedPlaylist] = useState<Playlist | null>(null);
  const [producerProfile, setProducerProfile] = useState<ProducerProfile>({ name: '', contactInfo: '', bio: '' });
  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({});
  
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Load from URL hash or local storage on initial mount
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    if (hash) {
      try {
        const decodedPlaylist: Playlist = JSON.parse(decodeURIComponent(escape(atob(hash))));

        if (decodedPlaylist.expiresAt && Date.now() > decodedPlaylist.expiresAt) {
          setIsLinkExpired(true);
          return;
        }

        if (decodedPlaylist.password) {
            setPasswordProtectedPlaylist(decodedPlaylist);
            return;
        }

        setPlaylist(decodedPlaylist);
        setIsViewerMode(true);
        if (decodedPlaylist.songs.length > 0) {
          setCurrentSong(decodedPlaylist.songs[0]);
        }
      } catch (error) {
        console.error("Failed to parse playlist from URL hash:", error);
      }
    } else {
        // Load saved playlists and producer profile from local storage
        try {
            const storedPlaylists = localStorage.getItem('producerPlaylists');
            if (storedPlaylists) setSavedPlaylists(JSON.parse(storedPlaylists));
            
            const storedProfile = localStorage.getItem('producerProfile');
            if (storedProfile) setProducerProfile(JSON.parse(storedProfile));

            const storedLibrary = localStorage.getItem('songLibrary');
            if (storedLibrary) {
                setUploadedSongs(JSON.parse(storedLibrary));
            }
            
            const storedActivePlaylist = localStorage.getItem('activePlaylist');
            if (storedActivePlaylist) {
                setPlaylist(JSON.parse(storedActivePlaylist));
            }
        } catch (error) {
            console.error("Failed to load data from local storage:", error);
        }
    }
  }, []);

  // Save producer profile to local storage whenever it changes
  useEffect(() => {
    try {
        if (!isViewerMode) {
            localStorage.setItem('producerProfile', JSON.stringify(producerProfile));
        }
    } catch (error) {
        console.error("Failed to save producer profile:", error);
    }
  }, [producerProfile, isViewerMode]);
  
  // Save current workspace (active playlist and library) to local storage
  useEffect(() => {
    if (!isViewerMode) {
        try {
            const playlistToSave = {
                ...playlist,
                songs: playlist.songs.map(({ file, url, ...rest }) => rest)
            };
            localStorage.setItem('activePlaylist', JSON.stringify(playlistToSave));
            
            const libraryToSave = uploadedSongs.map(({ file, url, ...rest }) => rest);
            localStorage.setItem('songLibrary', JSON.stringify(libraryToSave));

        } catch (error) {
            console.error("Failed to save workspace to local storage:", error);
        }
    }
  }, [playlist, uploadedSongs, isViewerMode]);

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => {
      setNotification(null);
    }, 2000);
  };

  useEffect(() => {
    if (audioRef.current && currentSong) {
      if (currentSong.url) {
        audioRef.current.src = currentSong.url;
        if (isPlaying) {
          audioRef.current.play().catch(e => console.error("Error playing audio:", e));
        }
      } else if (isPlaying) {
          setIsPlaying(false);
      }
    }
  }, [currentSong]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleSongEnd = () => {
      const currentIdx = playlist.songs.findIndex(s => s.id === currentSong?.id);
      if (currentIdx !== -1 && currentIdx < playlist.songs.length - 1) {
        setCurrentSong(playlist.songs[currentIdx + 1]);
      } else {
        setIsPlaying(false);
      }
    }

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleSongEnd);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleSongEnd);
    };
  }, [currentSong, playlist.songs]);

  const updateSongInState = useCallback((songId: string, updates: Partial<Song>) => {
    const updater = (s: Song) => s.id === songId ? { ...s, ...updates } : s;
    setUploadedSongs(prev => prev.map(updater));
    setPlaylist(prev => ({
        ...prev,
        songs: prev.songs.map(updater)
    }));
    if (currentSong?.id === songId) {
        setCurrentSong(prev => prev ? { ...prev, ...updates } : null);
    }
  }, [currentSong?.id]);

  const analyzeTrack = useCallback(async (song: Song) => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Analyze the following track title and provide its estimated BPM, musical key, genre, mood, instrumentation (as a JSON array of strings), and a few relevant genre tags (as a JSON array of strings). Track title: "${song.name}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              bpm: { type: Type.STRING },
              key: { type: Type.STRING },
              genre: { type: Type.STRING },
              mood: { type: Type.STRING },
              instrumentation: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              genreTags: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
          },
        },
      });
      
      const data = JSON.parse(response.text);
      updateSongInState(song.id, { 
          bpm: data.bpm || 'N/A', 
          key: data.key || 'N/A', 
          genre: data.genre || 'N/A', 
          mood: data.mood || 'N/A',
          instrumentation: data.instrumentation || [],
          genreTags: data.genreTags || [],
          analyzing: false 
      });

    } catch (error) {
      console.error("Failed to analyze track:", error);
      updateSongInState(song.id, { analyzing: false });
    }
  }, [ai.models, updateSongInState]);

  const handleManualAnalysis = (song: Song) => {
    updateSongInState(song.id, { analyzing: true });
    analyzeTrack(song);
  };

  const handlePlayPause = (song: Song) => {
    if (currentSong?.id === song.id) {
      if (isPlaying) {
        audioRef.current?.pause();
      } else {
        audioRef.current?.play();
      }
    } else {
      setCurrentSong(song);
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Number(e.target.value);
    }
  };

  const handleSongsUploaded = (newSongs: Song[]) => {
    const songMap = new Map(uploadedSongs.map(s => [s.id, s]));
    const songsToAnalyze: Song[] = [];

    newSongs.forEach(newSong => {
        const existingSong = songMap.get(newSong.id);
        const isNewAnalysisNeeded = !existingSong || !existingSong.bpm;

        const updatedSong = { 
            ...(existingSong || {}), 
            ...newSong, 
            analyzing: isNewAnalysisNeeded 
        };
        
        songMap.set(newSong.id, updatedSong);
        
        if (isNewAnalysisNeeded) {
            songsToAnalyze.push(updatedSong);
        }
    });
    
    const newUploadedSongs = Array.from(songMap.values());
    setUploadedSongs(newUploadedSongs);

    setPlaylist(prev => ({
        ...prev,
        songs: prev.songs.map(pSong => songMap.get(pSong.id) || pSong)
    }));

    songsToAnalyze.forEach(analyzeTrack);
  };

  const addSongToPlaylist = (song: Song) => {
    if (!playlist.songs.find(s => s.id === song.id)) {
      setPlaylist(prev => ({ ...prev, songs: [...prev.songs, song] }));
    }
  };

  const removeSongFromPlaylist = (songId: string) => {
    setPlaylist(prev => ({ ...prev, songs: prev.songs.filter(s => s.id !== songId) }));
    if (currentSong?.id === songId) {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
        }
        setCurrentSong(null);
        setIsPlaying(false);
    }
  };
  
  const deleteSongFromLibrary = (songId: string) => {
    const songToDelete = uploadedSongs.find(s => s.id === songId);
    if (songToDelete && songToDelete.url) {
        URL.revokeObjectURL(songToDelete.url);
    }
    setUploadedSongs(prev => prev.filter(s => s.id !== songId));
    removeSongFromPlaylist(songId);
    if (currentSong?.id === songId) {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
        }
        setCurrentSong(null);
        setIsPlaying(false);
    }
  };

  const reorderSongInPlaylist = (songId: string, direction: 'up' | 'down') => {
    const songIndex = playlist.songs.findIndex(s => s.id === songId);
    if (songIndex === -1) return;

    if (direction === 'up' && songIndex > 0) {
      const newSongs = [...playlist.songs];
      [newSongs[songIndex - 1], newSongs[songIndex]] = [newSongs[songIndex], newSongs[songIndex - 1]];
      setPlaylist(prev => ({ ...prev, songs: newSongs }));
    } else if (direction === 'down' && songIndex < playlist.songs.length - 1) {
      const newSongs = [...playlist.songs];
      [newSongs[songIndex + 1], newSongs[songIndex]] = [newSongs[songIndex], newSongs[songIndex + 1]];
      setPlaylist(prev => ({ ...prev, songs: newSongs }));
    }
  };
  
  const handleSavePlaylist = () => {
    const playlistToSave: Playlist = {
      ...playlist,
      producerProfile: producerProfile,
      songs: playlist.songs.map(({ file, analyzing, url, ...song }) => song as Song),
    };

    setSavedPlaylists(prev => {
      const existingIndex = prev.findIndex(p => p.id === playlist.id);
      let newPlaylists;
      if (existingIndex > -1) {
        newPlaylists = [...prev];
        newPlaylists[existingIndex] = playlistToSave;
      } else {
        newPlaylists = [...prev, playlistToSave];
      }
      localStorage.setItem('producerPlaylists', JSON.stringify(newPlaylists));
      showNotification(`Playlist "${playlist.name}" saved!`);
      return newPlaylists;
    });
  };

  const handleExportPlaylist = () => {
    const playlistToExport: Playlist = {
      ...playlist,
      producerProfile: producerProfile,
      songs: playlist.songs.map(({ file, analyzing, url, ...song }) => song as Song),
    };

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(playlistToExport, null, 2)
    )}`;
    
    const link = document.createElement("a");
    link.href = jsonString;
    const sanitizedName = playlist.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `${sanitizedName || 'playlist'}.json`;

    link.click();
    showNotification("Playlist exported as JSON!");
  };

  const handleLoadPlaylist = (playlistId: string) => {
    const playlistToLoad = savedPlaylists.find(p => p.id === playlistId);
    if (playlistToLoad) {
      const hydratedSongs = playlistToLoad.songs.map(savedSong => {
        const librarySong = uploadedSongs.find(libSong => libSong.id === savedSong.id);
        return librarySong || savedSong;
      });

      setPlaylist({ ...playlistToLoad, songs: hydratedSongs });
      if (playlistToLoad.producerProfile) {
        setProducerProfile(playlistToLoad.producerProfile);
      }
      showNotification(`Playlist "${playlistToLoad.name}" loaded!`);
    }
  };

  const handleDeleteSavedPlaylist = (playlistId: string) => {
      setSavedPlaylists(prev => {
          const newPlaylists = prev.filter(p => p.id !== playlistId);
          localStorage.setItem('producerPlaylists', JSON.stringify(newPlaylists));
          showNotification(`Playlist deleted.`);
          return newPlaylists;
      });
  };
  
  const handleNewPlaylist = () => {
    setPlaylist({ id: `playlist-${Date.now()}`, name: "Untitled Playlist", songs: [] });
    showNotification("New playlist created.");
  };

  const handleAddComment = (songId: string, commentText: string) => {
    if (!commentText.trim()) return;
    const newComment: Comment = { text: commentText };
    setPlaylist(prevPlaylist => {
      const newSongs = prevPlaylist.songs.map(song => {
        if (song.id === songId) {
          return {
            ...song,
            comments: [...(song.comments || []), newComment]
          };
        }
        return song;
      });
      return { ...prevPlaylist, songs: newSongs };
    });
  };

  const handleUnlockPlaylist = (unlockedPlaylist: Playlist) => {
    setPasswordProtectedPlaylist(null);
    setPlaylist(unlockedPlaylist);
    setIsViewerMode(true);
    if (unlockedPlaylist.songs.length > 0) {
      setCurrentSong(unlockedPlaylist.songs[0]);
    }
  };

  const handleStartEditing = (song: Song) => {
    setExpandedSongId(song.id); // Ensure the item is expanded
    setEditingSongId(song.id);
    setEditFormData({
        name: song.name,
        bpm: song.bpm || '',
        key: song.key || '',
        genre: song.genre || '',
        mood: song.mood || '',
        instrumentation: (song.instrumentation || []).join(', '),
        genreTags: (song.genreTags || []).join(', '),
    });
  };

  const handleCancelEditing = () => {
    setEditingSongId(null);
    setEditFormData({});
  };

  const handleSaveEditing = () => {
    if (!editingSongId) return;

    const updates: Partial<Song> = {
        name: editFormData.name,
        bpm: editFormData.bpm || undefined,
        key: editFormData.key || undefined,
        genre: editFormData.genre || undefined,
        mood: editFormData.mood || undefined,
        instrumentation: editFormData.instrumentation?.split(',').map(s => s.trim()).filter(Boolean) || [],
        genreTags: editFormData.genreTags?.split(',').map(s => s.trim()).filter(Boolean) || [],
    };

    updateSongInState(editingSongId, updates);
    handleCancelEditing();
  };

  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };

  const PasswordPromptModal: React.FC<{ playlist: Playlist, onUnlock: (playlist: Playlist) => void }> = ({ playlist, onUnlock }) => {
    const [passwordAttempt, setPasswordAttempt] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordAttempt === playlist.password) {
            onUnlock(playlist);
        } else {
            setError('Incorrect password. Please try again.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm m-4">
                <h2 className="text-xl font-bold text-teal-300 mb-4 flex items-center gap-2">
                    <LockClosedIcon />
                    Password Required
                </h2>
                <p className="text-gray-400 mb-4">This playlist is password protected. Please enter the password to continue.</p>
                <form onSubmit={handleSubmit}>
                    <input
                        type="password"
                        value={passwordAttempt}
                        onChange={(e) => {
                            setPasswordAttempt(e.target.value);
                            setError('');
                        }}
                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-md p-2 focus:ring-teal-500 focus:border-teal-500"
                        placeholder="Enter password"
                        autoFocus
                    />
                    {error && <p role="alert" className="text-red-400 text-sm mt-2">{error}</p>}
                    <button type="submit" className="mt-4 w-full bg-teal-600 text-white px-4 py-2 rounded-md hover:bg-teal-500 transition-colors">
                        Unlock Playlist
                    </button>
                </form>
            </div>
        </div>
    );
  };

  const CommentSection: React.FC<{ song: Song; onAddComment: (songId: string, text: string) => void }> = ({ song, onAddComment }) => {
    const [commentText, setCommentText] = useState('');
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onAddComment(song.id, commentText);
      setCommentText('');
    };

    return (
      <div className="mt-3">
        <h4 className="font-semibold text-sm text-gray-300 mb-2">Feedback & Comments</h4>
        <div className="space-y-2 mb-3 max-h-24 overflow-y-auto">
          {(!song.comments || song.comments.length === 0) && <p className="text-xs text-gray-500">No comments yet.</p>}
          {song.comments?.map((comment, index) => (
            <div key={index} className="flex items-start gap-2">
              <CommentIcon className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0"/>
              <p className="text-sm text-gray-400 bg-gray-800/50 p-2 rounded-md w-full">{comment.text}</p>
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment..."
            className="flex-grow bg-gray-700 text-sm rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button type="submit" className="bg-teal-600 text-sm text-white px-3 py-1.5 rounded-md hover:bg-teal-500 transition-colors">Add</button>
        </form>
      </div>
    );
  };
  
  const FeedbackModal: React.FC<{ isOpen: boolean; onClose: () => void; playlist: Playlist }> = ({ isOpen, onClose, playlist }) => {
    const [copied, setCopied] = useState(false);
    
    if (!isOpen) return null;

    const generateFeedbackText = () => {
      let text = `Feedback for Playlist: "${playlist.name}"\n`;
      if (playlist.producerProfile?.name) {
          text += `From: ${playlist.producerProfile.name}\n`;
      }
      text += '\n';

      playlist.songs.forEach(song => {
        if (song.comments && song.comments.length > 0) {
          text += `Track: ${song.name}\n`;
          song.comments.forEach(comment => {
            text += `- ${comment.text}\n`;
          });
          text += '\n';
        }
      });
      return text;
    };

    const copyToClipboard = () => {
      navigator.clipboard.writeText(generateFeedbackText()).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg m-4" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-teal-300 mb-4">Export Feedback</h2>
                <p className="text-gray-400 mb-4">Here is a summary of all comments. Copy this and send it back to the producer.</p>
                <textarea
                    readOnly
                    value={generateFeedbackText()}
                    className="w-full h-48 bg-gray-900 text-gray-300 p-3 rounded-md text-sm font-mono border border-gray-700"
                />
                <button
                    onClick={copyToClipboard}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-500 transition-colors"
                >
                    {copied ? <CheckIcon/> : <ClipboardIcon/>}
                    {copied ? 'Copied to Clipboard!' : 'Copy Feedback'}
                </button>
            </div>
        </div>
    );
  };

  const ProducerProfileSection = () => (
    <div className="bg-gray-800 p-4 rounded-lg">
        <h2 className="text-xl font-bold mb-4 text-teal-300 flex items-center gap-2">
            <UserCircleIcon />
            Producer Profile
        </h2>
        <div className="space-y-4">
            <div>
                <label htmlFor="producerName" className="block text-sm font-medium text-gray-400 mb-1">Your Name</label>
                <input type="text" id="producerName" value={producerProfile.name} onChange={e => setProducerProfile(p => ({ ...p, name: e.target.value }))}
                    className="w-full bg-gray-700 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="e.g., OGG BEATZ MUSIC"
                />
            </div>
            <div>
                <label htmlFor="producerContact" className="block text-sm font-medium text-gray-400 mb-1">Website / Social Link</label>
                <input type="text" id="producerContact" value={producerProfile.contactInfo} onChange={e => setProducerProfile(p => ({ ...p, contactInfo: e.target.value }))}
                    className="w-full bg-gray-700 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="https://example.com"
                />
            </div>
            <div>
                <label htmlFor="producerBio" className="block text-sm font-medium text-gray-400 mb-1">Short Bio / Message</label>
                <textarea id="producerBio" value={producerProfile.bio} onChange={e => setProducerProfile(p => ({ ...p, bio: e.target.value }))}
                    className="w-full bg-gray-700 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 h-20 resize-none" placeholder="A short message for your clients..."
                />
            </div>
        </div>
    </div>
  );


  const SongItem: React.FC<{
    song: Song;
    actions?: React.ReactNode;
    isPlaying: boolean;
    isCurrent: boolean;
    onPlayPause: (song: Song) => void;
    extraControls?: React.ReactNode;
  }> = ({ song, actions, isPlaying, isCurrent, onPlayPause, extraControls }) => {
    const isExpanded = expandedSongId === song.id;
    const isEditing = editingSongId === song.id;

    const handleToggleExpand = (e: React.MouseEvent<HTMLDivElement>) => {
      // Prevent toggle when clicking on a button inside, or if we are editing
      if ((e.target as HTMLElement).closest('button, a, input') || isEditing) return;
      setExpandedSongId(prevId => prevId === song.id ? null : song.id)
    };
    
    return (
      <div className={`rounded-md transition-all duration-300 ${isExpanded ? 'bg-gray-700/50' : ''}`}>
        <div 
          onClick={handleToggleExpand}
          className={`flex items-center p-3 transition-colors duration-200 cursor-pointer ${isCurrent ? 'bg-teal-600/30' : 'hover:bg-gray-700/80'}`}
        >
            <button onClick={() => onPlayPause(song)} className="mr-4 flex-shrink-0" aria-label={isCurrent && isPlaying ? `Pause ${song.name}` : `Play ${song.name}`} disabled={!song.url}>
                {isCurrent && isPlaying ? <PauseIcon className="w-6 h-6 text-teal-300" /> : <PlayIcon className={`w-6 h-6 ${song.url ? 'text-gray-400 hover:text-white' : 'text-gray-600 cursor-not-allowed'}`} />}
            </button>
            <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`font-medium truncate ${isCurrent ? 'text-teal-300' : 'text-gray-200'}`}>{song.name}</p>
                  {song.analyzing && <LoadingSpinnerIcon className="w-4 h-4 text-gray-400" />}
                </div>
                {!song.analyzing && (song.bpm || song.key || song.genre) && (
                  <div className="flex items-center gap-2 flex-wrap mt-1.5">
                      {song.bpm && <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">{song.bpm} BPM</span>}
                      {song.key && <span className="text-xs bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded-full">Key: {song.key}</span>}
                      {song.genre && <span className="text-xs bg-green-900/50 text-green-300 px-2 py-0.5 rounded-full">{song.genre}</span>}
                  </div>
                )}
            </div>
            <div className="flex items-center space-x-2 pl-2">
              <span className="text-sm text-gray-400 hidden sm:block">{formatTime(song.duration)}</span>
              {extraControls}
              {!isViewerMode && actions}
              <button onClick={(e) => { e.stopPropagation(); setExpandedSongId(isExpanded ? null : song.id)}} className="p-2 rounded-full hover:bg-gray-600/50" aria-label={isExpanded ? 'Collapse' : 'Expand'}>
                {isExpanded ? <ChevronUpIcon className="w-5 h-5 text-gray-400"/> : <ChevronDownIcon className="w-5 h-5 text-gray-400"/>}
              </button>
            </div>
        </div>
        {isExpanded && (
            <div className="p-4 bg-gray-900/30 border-t border-gray-700/50">
                {isEditing ? (
                  <div className="space-y-3 text-sm">
                      <div>
                          <label htmlFor={`name-${song.id}`} className="block font-medium text-gray-400 mb-1">Track Name</label>
                          <input type="text" id={`name-${song.id}`} name="name" value={editFormData.name || ''} onChange={handleEditFormChange} className="w-full bg-gray-700 rounded p-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                          <div>
                              <label htmlFor={`bpm-${song.id}`} className="block font-medium text-gray-400 mb-1">BPM</label>
                              <input type="text" id={`bpm-${song.id}`} name="bpm" value={editFormData.bpm || ''} onChange={handleEditFormChange} className="w-full bg-gray-700 rounded p-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                          </div>
                          <div>
                              <label htmlFor={`key-${song.id}`} className="block font-medium text-gray-400 mb-1">Key</label>
                              <input type="text" id={`key-${song.id}`} name="key" value={editFormData.key || ''} onChange={handleEditFormChange} className="w-full bg-gray-700 rounded p-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                          </div>
                          <div>
                              <label htmlFor={`genre-${song.id}`} className="block font-medium text-gray-400 mb-1">Genre</label>
                              <input type="text" id={`genre-${song.id}`} name="genre" value={editFormData.genre || ''} onChange={handleEditFormChange} className="w-full bg-gray-700 rounded p-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                          </div>
                          <div>
                              <label htmlFor={`mood-${song.id}`} className="block font-medium text-gray-400 mb-1">Mood</label>
                              <input type="text" id={`mood-${song.id}`} name="mood" value={editFormData.mood || ''} onChange={handleEditFormChange} className="w-full bg-gray-700 rounded p-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                          </div>
                      </div>
                      <div>
                          <label htmlFor={`instrumentation-${song.id}`} className="block font-medium text-gray-400 mb-1">Instrumentation (comma-separated)</label>
                          <input type="text" id={`instrumentation-${song.id}`} name="instrumentation" value={editFormData.instrumentation || ''} onChange={handleEditFormChange} className="w-full bg-gray-700 rounded p-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="e.g., synth, drums, bass" />
                      </div>
                      <div>
                          <label htmlFor={`genreTags-${song.id}`} className="block font-medium text-gray-400 mb-1">Genre Tags (comma-separated)</label>
                          <input type="text" id={`genreTags-${song.id}`} name="genreTags" value={editFormData.genreTags || ''} onChange={handleEditFormChange} className="w-full bg-gray-700 rounded p-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="e.g., trap, lo-fi, chill" />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                          <button onClick={handleCancelEditing} className="px-3 py-1.5 bg-gray-600 rounded-md hover:bg-gray-500">Cancel</button>
                          <button onClick={handleSaveEditing} className="px-3 py-1.5 bg-teal-600 rounded-md hover:bg-teal-500">Save Changes</button>
                      </div>
                  </div>
                ) : (
                  <>
                    {!song.analyzing ? (
                      <>
                        {(song.mood || (song.instrumentation && song.instrumentation.length > 0)) && (
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                                {song.mood && <span className="text-xs bg-yellow-900/50 text-yellow-300 px-2 py-0.5 rounded-full">{song.mood}</span>}
                                {song.instrumentation && song.instrumentation.map(inst => (
                                    <span key={inst} className="text-xs bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded-full">{inst}</span>
                                ))}
                            </div>
                        )}
                        {song.genreTags && song.genreTags.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap">
                                {song.genreTags.map(tag => (
                                    <span key={tag} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{`#${tag}`}</span>
                                ))}
                            </div>
                        )}
                        {isViewerMode && <CommentSection song={song} onAddComment={handleAddComment} />}
                      </>
                    ) : <p className="text-sm text-gray-400">Analyzing track details...</p>}
                  </>
                )}
            </div>
        )}
      </div>
    );
  };

  if (isLinkExpired) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center p-8 bg-gray-800 rounded-lg shadow-xl">
          <h1 className="text-3xl font-bold text-red-400 mb-2">Link Expired</h1>
          <p className="text-gray-400">This shared playlist link has expired and is no longer available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col font-sans">
      <header className="bg-gray-800/50 backdrop-blur-sm p-4 shadow-lg border-b border-gray-700 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
            <h1 className="text-2xl md:text-3xl font-bold text-teal-300 tracking-wider">Producer Playlist Hub</h1>
            {isViewerMode && (
                <button 
                    onClick={() => setFeedbackModalOpen(true)} 
                    className="flex items-center gap-2 bg-teal-600 px-3 py-2 rounded-md hover:bg-teal-500 transition-colors text-sm font-semibold">
                    <CommentIcon className="w-5 h-5" />
                    <span>Export Feedback</span>
                </button>
            )}
        </div>
        {isViewerMode && playlist.producerProfile?.name && (
            <div className="max-w-7xl mx-auto mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
                <h3 className="font-bold text-lg text-gray-200">{playlist.producerProfile.name}</h3>
                {playlist.producerProfile.bio && <p className="text-sm text-gray-400 mt-1">{playlist.producerProfile.bio}</p>}
                {playlist.producerProfile.contactInfo && (
                    <a href={playlist.producerProfile.contactInfo} target="_blank" rel="noopener noreferrer" 
                       className="flex items-center gap-1.5 text-sm text-teal-400 hover:text-teal-300 mt-2">
                        <LinkIcon className="w-4 h-4" />
                        <span>{playlist.producerProfile.contactInfo}</span>
                    </a>
                )}
            </div>
        )}
      </header>
      
      {notification && (
        <div className="fixed top-20 right-8 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse">
          {notification}
        </div>
      )}

      <main className="flex-grow p-4 md:p-8 flex flex-col lg:flex-row gap-8 pb-32">
        {!isViewerMode && (
          <div className="lg:w-1/2 flex flex-col gap-8">
            <FileUpload onSongsUploaded={handleSongsUploaded} disabled={isViewerMode} />
            <ProducerProfileSection />
            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-xl font-bold mb-4 text-teal-300">Your Library</h2>
              <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-2">
                {uploadedSongs.length > 0 ? uploadedSongs.map(song => (
                  <SongItem
                    key={song.id} song={song} isPlaying={isPlaying} isCurrent={currentSong?.id === song.id}
                    onPlayPause={handlePlayPause}
                    actions={<>
                      <button onClick={() => handleStartEditing(song)} className="p-2 rounded-full hover:bg-gray-600" title="Edit metadata">
                          <EditIcon className="w-5 h-5 text-gray-400 hover:text-teal-300"/>
                      </button>
                      {!song.analyzing && (
                        <button onClick={() => handleManualAnalysis(song)} className="p-2 rounded-full hover:bg-gray-600" title={song.bpm ? "Re-analyze track" : "Analyze track"}>
                            <AnalyzeIcon className="w-5 h-5 text-gray-400 hover:text-teal-300"/>
                        </button>
                      )}
                      <button onClick={() => addSongToPlaylist(song)} className="p-2 rounded-full hover:bg-gray-600" title="Add to playlist">
                        <PlusIcon className="w-5 h-5 text-gray-400 hover:text-white"/>
                      </button>
                      <button onClick={() => deleteSongFromLibrary(song.id)} className="p-2 rounded-full hover:bg-gray-600" title="Delete from library">
                          <TrashIcon className="w-5 h-5 text-gray-400 hover:text-red-400"/>
                      </button>
                    </>}
                  />
                )) : <p className="text-gray-500 text-center py-8">Upload tracks to see them here.</p>}
              </div>
            </div>
             <div className="bg-gray-800 p-4 rounded-lg flex-grow">
              <h2 className="text-xl font-bold mb-4 text-teal-300">Saved Playlists</h2>
              <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-2">
                {savedPlaylists.length > 0 ? savedPlaylists.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-md bg-gray-700/50">
                    <div>
                        <p className="font-medium text-gray-200">{p.name}</p>
                        <p className="text-sm text-gray-400">{p.songs.length} track{p.songs.length !== 1 && 's'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => handleLoadPlaylist(p.id)} className="text-sm bg-teal-600 px-3 py-1 rounded-md hover:bg-teal-500 transition-colors">Load</button>
                        <button onClick={() => handleDeleteSavedPlaylist(p.id)} className="p-2 rounded-full hover:bg-gray-600" title="Delete saved playlist">
                            <TrashIcon className="w-5 h-5 text-gray-400 hover:text-red-400" />
                        </button>
                    </div>
                  </div>
                )) : <p className="text-gray-500 text-center py-8">Save a playlist to see it here.</p>}
              </div>
            </div>
          </div>
        )}
        
        <div className={isViewerMode ? 'w-full max-w-4xl mx-auto' : 'lg:w-1/2'}>
          <div className="bg-gray-800 p-4 rounded-lg h-full flex flex-col">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <input 
                  type="text" value={playlist.name} onChange={e => !isViewerMode && setPlaylist(p => ({ ...p, name: e.target.value }))}
                  placeholder="My Next Hit Playlist"
                  className={`text-xl font-bold bg-transparent text-teal-300 w-full md:w-auto flex-grow focus:outline-none ${!isViewerMode ? 'border-b-2 border-transparent focus:border-teal-400' : ''}`}
                  readOnly={isViewerMode} aria-label="Playlist name"
                />
              {!isViewerMode && (
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={handleNewPlaylist} className="text-sm bg-gray-600 px-3 py-2 rounded-md hover:bg-gray-500 font-semibold">New</button>
                    <button onClick={handleSavePlaylist} disabled={playlist.songs.length === 0} className="flex items-center gap-2 bg-blue-600 px-3 py-2 rounded-md hover:bg-blue-500 text-sm font-semibold disabled:opacity-50">
                        <SaveIcon /><span>Save</span>
                    </button>
                    <button onClick={handleExportPlaylist} disabled={playlist.songs.length === 0} className="flex items-center gap-2 bg-indigo-600 px-3 py-2 rounded-md hover:bg-indigo-500 text-sm font-semibold disabled:opacity-50">
                        <ExportIcon /><span>Export</span>
                    </button>
                    <button onClick={() => setShareModalOpen(true)} disabled={playlist.songs.length === 0} className="flex items-center gap-2 bg-teal-600 px-3 py-2 rounded-md hover:bg-teal-500 text-sm font-semibold disabled:opacity-50">
                      <ShareIcon /><span>Share</span>
                    </button>
                </div>
              )}
            </div>
            <div className="space-y-2 flex-grow max-h-[calc(100vh-20rem)] overflow-y-auto pr-2">
              {playlist.songs.length > 0 ? playlist.songs.map((song, index) => (
                <SongItem
                  key={song.id} song={song} isPlaying={isPlaying} isCurrent={currentSong?.id === song.id} onPlayPause={handlePlayPause}
                  actions={!isViewerMode ?
                    <>
                      <button onClick={() => handleStartEditing(song)} className="p-2 rounded-full hover:bg-gray-600" title="Edit metadata">
                          <EditIcon className="w-5 h-5 text-gray-400 hover:text-teal-300"/>
                      </button>
                      <button onClick={() => removeSongFromPlaylist(song.id)} className="p-2 rounded-full hover:bg-gray-600" title="Remove from playlist">
                        <TrashIcon className="w-5 h-5 text-gray-400 hover:text-red-400"/>
                      </button>
                    </> : undefined
                  }
                  extraControls={!isViewerMode ? (
                    <>
                      <button onClick={() => reorderSongInPlaylist(song.id, 'up')} disabled={index === 0} className="p-2 rounded-full hover:bg-gray-600 disabled:opacity-30" aria-label={`Move ${song.name} up`}>
                        <ChevronUpIcon className="w-4 h-4 text-gray-400" />
                      </button>
                      <button onClick={() => reorderSongInPlaylist(song.id, 'down')} disabled={index === playlist.songs.length - 1} className="p-2 rounded-full hover:bg-gray-600 disabled:opacity-30" aria-label={`Move ${song.name} down`}>
                        <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                      </button>
                    </>
                  ) : <span className="w-4 mr-10"></span>}
                />
              )) : 
              <div className="flex items-center justify-center h-full">
                 <p className="text-gray-500 text-center py-8">
                  {isViewerMode ? "This playlist is empty." : "Add songs from your library to build a playlist."}
                 </p>
              </div>
              }
            </div>
          </div>
        </div>
      </main>

      {currentSong && (
        <footer className="fixed bottom-0 left-0 right-0 bg-gray-800/80 backdrop-blur-md border-t border-gray-700 p-4 z-20">
          <audio ref={audioRef} />
          <div className="max-w-7xl mx-auto flex items-center gap-4">
            <button onClick={() => handlePlayPause(currentSong)} className="text-teal-300 hover:text-teal-200" aria-label={isPlaying ? "Pause" : "Play"} disabled={!currentSong.url}>
              {isPlaying ? <PauseIcon className="w-8 h-8" /> : <PlayIcon className={`w-8 h-8 ${!currentSong.url && 'opacity-50'}`} />}
            </button>
            <div className="flex-grow flex items-center gap-4">
                <p className="w-32 truncate text-gray-300 font-medium">{currentSong.name}</p>
                <span className="text-sm text-gray-400">{formatTime(currentTime)}</span>
                <input
                    type="range" min="0" max={duration || 0} value={currentTime} onChange={handleSeek}
                    className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-teal-400"
                    aria-label="Seek slider" disabled={!currentSong.url}
                />
                <span className="text-sm text-gray-400">{formatTime(duration)}</span>
            </div>
          </div>
        </footer>
      )}
      
      <ShareModal 
        isOpen={isShareModalOpen} 
        onClose={() => setShareModalOpen(false)}
        playlist={playlist}
        producerProfile={producerProfile}
      />
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        playlist={playlist}
      />
      {passwordProtectedPlaylist && (
        <PasswordPromptModal 
            playlist={passwordProtectedPlaylist}
            onUnlock={handleUnlockPlaylist}
        />
      )}
    </div>
  );
};

export default App;
