
import React, { useState, useCallback, useRef } from 'react';
import type { Song } from '../types';
import { UploadIcon } from './Icons';

interface FileUploadProps {
  onSongsUploaded: (songs: Song[]) => void;
  disabled: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onSongsUploaded, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const audio = document.createElement('audio');
      audio.src = URL.createObjectURL(file);
      audio.addEventListener('loadedmetadata', () => {
        resolve(audio.duration);
        URL.revokeObjectURL(audio.src);
      });
    });
  };

  const processFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newSongs: Song[] = [];
    for (const file of Array.from(files)) {
      if (file.type.startsWith('audio/')) {
        const duration = await getAudioDuration(file);
        newSongs.push({
          id: `${file.name}-${file.size}-${Date.now()}`,
          name: file.name.replace(/\.[^/.]+$/, ""),
          url: URL.createObjectURL(file),
          duration: duration,
          file: file,
        });
      }
    }
    onSongsUploaded(newSongs);
  }, [onSongsUploaded]);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
  };
  
  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="p-4 rounded-lg bg-gray-800">
      <h2 className="text-xl font-bold mb-4 text-teal-300">Upload Your Tracks</h2>
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700/50 hover:border-teal-400'
        } ${isDragging ? 'bg-gray-700 border-teal-400' : 'border-gray-600'}`}
      >
        <input
          type="file"
          accept="audio/*"
          multiple
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />
        <UploadIcon className="w-10 h-10 text-gray-500 mb-3" />
        <p className="text-gray-400 text-center">
          <span className="font-semibold text-teal-400">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-gray-500">MP3, WAV, FLAC, etc.</p>
      </div>
    </div>
  );
};
