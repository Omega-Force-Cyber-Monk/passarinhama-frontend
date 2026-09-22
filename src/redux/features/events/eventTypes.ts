export interface EventCreator {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
}

export interface EventCategory {
  id: string;
  name: string;
  color_code?: string | null;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Event {
  id: string;
  title: string;
  event_type?: 'general' | 'training' | 'commission' | 'board' | string;
  event_category_id?: string | null;
  event_category?: EventCategory | null;
  event_date: string;
  end_date: string | null;
  day: number;
  month: string;
  event_time: string;
  location: string;
  description: string;
  max_attendees: number;
  attendee_count: number;
  spots_left: number;
  is_at_capacity: boolean;
  is_registered: boolean;
  is_public: boolean;
  status?: string;
  attachments?: string[] | null;
  created_at: string;
  created_by: EventCreator;
}

export interface CalendarStats {
  events_this_year: number;
}

export interface GetEventsQueryParams {
  year: number;
  month: number;
  event_category_id?: string;
}

export interface CreateEventRequest {
  title: string;
  event_category_id?: string;
  event_type?: string;
  event_date: string;
  end_date: string;
  event_time: string;
  location: string;
  description: string;
  max_attendees: number;
  is_public: boolean;
  status?: string;
  attachments?: File[];
}

export interface UpdateEventRequest {
  title?: string;
  event_category_id?: string;
  event_type?: string;
  event_date?: string;
  end_date?: string;
  event_time?: string;
  location?: string;
  description?: string;
  max_attendees?: number;
  is_public?: boolean;
  status?: string;
  new_attachments?: File[];
  remove_attachment_urls?: string[];
}

export interface CreateEventCategoryRequest {
  name: string;
  description?: string | null;
  color_code?: string | null;
}

export interface UpdateEventCategoryRequest {
  id: string;
  name: string;
  description?: string | null;
  color_code?: string | null;
}

export interface EventRegistrationResponse {
  id: string;
  event_id: string;
  registered_at: string;
  message: string;
}

export interface EventRegistration {
  id: string;
  registered_at: string;
  user: EventCreator;
}

export interface EventRegistrationsList {
  event_id: string;
  event_title: string;
  total: number;
  max_attendees: number;
  registrations: EventRegistration[];
}
