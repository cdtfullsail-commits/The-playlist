import React, { useState, useEffect } from 'react';
import type { Playlist, ProducerProfile } from '../types';
import { ClipboardIcon, CheckIcon, ShareIcon, LoadingSpinnerIcon } from './Icons';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlist: Playlist;
  producerProfile: ProducerProfile;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, playlist, producerProfile }) => {
  const [copied, setCopied] = useState(false);
  const [expiration, setExpiration] = useState('never');
  const [shareUrl, setShareUrl] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [urlWarning, setUrlWarning] = useState<string | null>(null);

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  useEffect(() => {
    if (isOpen) {
      const generateUrl = async () => {
        setIsProcessing(true);
        setUrlWarning(null);
        setShareUrl('');

        let expiresAt: number | undefined = undefined;
        if (expiration !== 'never') {
          const now = new Date();
          const durationInMs = {
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
            '30d': 30 * 24 * 60 * 60 * 1000,
          }[expiration];
          expiresAt = now.getTime() + durationInMs!;
        }
        
        const songsWithDataUrls = await Promise.all(
          playlist.songs.map(async (song) => {
            const { file, analyzing, url, ...restOfSong } = song;
            let dataUrl = url;
            // Only convert file to data URL if a file exists and it's not already a data URL
            if (file && !url?.startsWith('data:')) {
              try {
                dataUrl = await fileToDataUrl(file);
              } catch (error) {
                console.error(`Failed to read file for song: ${song.name}`, error);
                dataUrl = undefined;
              }
            }
            return { ...restOfSong, url: dataUrl };
          })
        );


        const simplifiedPlaylist: Playlist = {
          ...playlist,
          expiresAt,
          password: usePassword && password ? password : undefined,
          songs: songsWithDataUrls,
          producerProfile,
        };

        const serialized = btoa(unescape(encodeURIComponent(JSON.stringify(simplifiedPlaylist))));
        const finalUrl = `${window.location.origin}${window.location.pathname}#${serialized}`;
        
        // Warn if URL is excessively long, which might cause issues in some browsers
        if (finalUrl.length > 8000) { 
            setUrlWarning(`Warning: This share link is very large (${(finalUrl.length / 1024).toFixed(1)} KB) and may not work in all browsers. Consider a smaller playlist for maximum compatibility.`);
        }

        setShareUrl(finalUrl);
        setIsProcessing(false);
      };

      generateUrl();

    } else {
        setCopied(false);
        setExpiration('never');
        setUsePassword(false);
        setPassword('');
        setIsProcessing(false);
        setUrlWarning(null);
    }
  }, [isOpen, expiration, playlist, usePassword, password, producerProfile]);

  if (!isOpen) return null;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity"
      onClick={onClose}
    >
      <div 
        className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md m-4 transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-teal-300 flex items-center">
            <ShareIcon className="w-6 h-6 mr-2" />
            Share Playlist
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>
        
        <div className="space-y-4">
            <div>
                <label htmlFor="expiration" className="block text-sm font-medium text-gray-300 mb-2">Link Expiration</label>
                <select
                    id="expiration"
                    value={expiration}
                    onChange={(e) => setExpiration(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-md p-2 focus:ring-teal-500 focus:border-teal-500"
                >
                    <option value="never">Never</option>
                    <option value="24h">24 Hours</option>
                    <option value="7d">7 Days</option>
                    <option value="30d">30 Days</option>
                </select>
            </div>
            <div>
                <div className="flex items-center justify-between">
                    <span id="password-protection-label" className="text-sm font-medium text-gray-300">Password Protection</span>
                    <button 
                        role="switch"
                        aria-checked={usePassword}
                        aria-labelledby="password-protection-label"
                        onClick={() => setUsePassword(!usePassword)}
                        className={`${usePassword ? 'bg-teal-600' : 'bg-gray-600'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-teal-500`}
                    >
                        <span className={`${usePassword ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}/>
                    </button>
                </div>
                {usePassword && (
                    <>
                        <label htmlFor="password" className="sr-only">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter a password"
                            className="mt-2 w-full bg-gray-900 border border-gray-700 text-white rounded-md p-2 focus:ring-teal-500 focus:border-teal-500"
                        />
                    </>
                )}
            </div>
        </div>

        <p className="text-gray-400 my-4">Share this link with your customer. They will see a read-only, offline-capable version of your playlist.</p>
        
        {isProcessing ? (
             <div className="flex items-center justify-center space-x-2 bg-gray-900 p-4 rounded-md h-[52px]">
                <LoadingSpinnerIcon />
                <span className="text-gray-400">Generating secure link...</span>
             </div>
        ) : (
            <div className="flex items-center space-x-2 bg-gray-900 p-2 rounded-md">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="bg-transparent text-gray-300 w-full outline-none"
              />
              <button
                onClick={copyToClipboard}
                className="flex items-center px-3 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-500 transition-colors duration-200"
              >
                {copied ? <CheckIcon className="w-5 h-5" /> : <ClipboardIcon className="w-5 h-5" />}
                <span className="ml-2 text-sm">{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
        )}

        {urlWarning && (
            <div className="mt-3 p-3 bg-yellow-900/50 border border-yellow-700 text-yellow-300 text-sm rounded-md">
                {urlWarning}
            </div>
        )}
      </div>
    </div>
  );
};