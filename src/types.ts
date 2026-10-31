export const ADMIN_EMAIL = 'gekosamu07@gmail.com';

export type UserRole = 'admin' | 'advisor';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string;
}

export interface RelatedMedia {
  title: string;
  url: string;
  type: 'image' | 'video' | 'link';
  thumbnail?: string;
  description?: string;
}

export interface AttachedFileInfo {
  name: string;
  fileType: 'pdf' | 'docx' | 'xlsx' | 'csv' | 'txt' | 'image' | 'other';
  size?: number;
  url?: string;
  thumbnail?: string;
  text?: string;
  base64?: string;
  mimeType?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  source?: string | null;
  timestamp: number;
  isSearching?: boolean;
  isStreaming?: boolean;
  isError?: boolean;
  isRateLimited?: boolean;
  contingency?: boolean;
  relatedMedia?: RelatedMedia[];
  attachedFile?: AttachedFileInfo;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeItem {
  id: string;
  name: string;
  description?: string; // Short description provided by admin (especially for images)
  type: 'file' | 'url';
  fileType?: 'pdf' | 'docx' | 'xlsx' | 'csv' | 'txt' | 'image' | 'other';
  category: string; // Capacitación, Procedimientos, Pagos, Precios, Garantías, Otros
  url?: string;
  storageUrl?: string;
  storagePath?: string;
  content: string;
  thumbnail?: string;
  size?: number;
  charCount: number;
  hasChunks?: boolean;
  totalParts?: number;
  createdAt: number;
  createdBy: string;
  updatedAt: number;
  updatedBy: string;
}

export interface UnansweredQuestion {
  id: string;
  question: string;
  askedBy: string;
  timestamp: number;
  status: 'pending' | 'reviewed';
}

export interface AdminRecord {
  id: string;
  email: string;
  addedAt: number;
  isInitialAdmin?: boolean;
}
