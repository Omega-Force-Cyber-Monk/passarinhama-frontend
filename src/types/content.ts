export interface Article {
  id: string;
  title: string;
  excerpt?: string;
  body?: string;
  content?: string; // Keep for fallback
  category_id: string;
  status: 'draft' | 'published' | 'archived';
  author_id?: string;
  created_at: string;
  updated_at?: string;
  published_at?: string | null;
  structured_fields?: {
    author?: string;
    tags?: string[];
    [key: string]: any;
  };
  // UI mapping fields (optional)
  category?: string;
  date?: string;
  author?: string;
  slug?: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  location: string;
  type: 'general' | 'training' | 'commission' | 'board';
  maxAttendees?: number;
  attendeeCount: number;
}

export interface Training {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  maxAttendees: number;
  attendeeCount: number;
  status: 'open' | 'full' | 'completed';
}
