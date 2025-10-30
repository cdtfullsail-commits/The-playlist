export interface Comment {
  text: string;
}

export interface Song {
  id: string;
  name: string;
  url?: string;
  duration: number; // in seconds
  file?: File;
  analyzing?: boolean;
  bpm?: string;
  genre?: string;
  key?: string;
  mood?: string;
  instrumentation?: string[];
  genreTags?: string[];
  comments?: Comment[];
}

export interface ProducerProfile {
    name: string;
    contactInfo: string;
    bio: string;
}

export interface Playlist {
  id: string;
  name: string;
  songs: Song[];
  expiresAt?: number; // Unix timestamp in milliseconds
  password?: string;
  producerProfile?: ProducerProfile;
}