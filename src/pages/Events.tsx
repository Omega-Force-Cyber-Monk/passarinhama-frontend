import React, { useEffect, useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  MapPin, 
  Clock, 
  Users, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  Download,
  Trash2,
  CalendarCheck,
  CheckCircle2,
  FileText,
  Globe,
  Link as LinkIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday, 
  addMonths, 
  subMonths,
  isWithinInterval,
  parseISO,
} from 'date-fns';
import { enUS } from 'date-fns/locale';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import { useAppToast } from '../components/ui/AppToastProvider';

import { useNavigate, useParams } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import {
  useDeleteEventMutation,
  useCreateEventMutation,
  useGetEventsQuery,
} from '../redux/features/events/eventsApi';
import type { Event as ApiEvent } from '../redux/features/events/eventTypes';


export default function Events() {
  const toast = useAppToast();
  const { hasPermission, canModify } = usePermissions();
  const canCreateEvent = hasPermission("event", "create");
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId?: string }>();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ApiEvent | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: '', type: 'general', day: '12', endDay: '12', time: '14:00', location: 'Zoom' });
  const [activeTab, setActiveTab] = useState<'info' | 'participants'>('info');
  const { currentData: apiEvents = [], isLoading: isLoadingEvents, isFetching: isFetchingEvents } = useGetEventsQuery({
    year: currentMonth.getFullYear(),
    month: currentMonth.getMonth() + 1,
  });
  const [deleteEvent] = useDeleteEventMutation();
  const [createEvent, { isLoading: isCreatingEvent }] = useCreateEventMutation();
  const events = apiEvents;


  const notifySuccess = (msg: string = 'Operation successful!') => {
    toast.success(msg);
  };

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  useEffect(() => {
    if (!eventId) {
      setSelectedEvent(null);
      return;
    }

    if (isLoadingEvents || isFetchingEvents) {
      if (selectedEvent?.id !== eventId) setSelectedEvent(null);
      return;
    }

    const matchedEvent = events.find((event) => event.id === eventId);

    if (matchedEvent) {
      setSelectedEvent(matchedEvent);
      setActiveTab('info');
      return;
    }
    navigate('/events', { replace: true });
  }, [eventId, events, isLoadingEvents, isFetchingEvents, navigate]);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateEvent || isCreatingEvent) return;

    if (!formData.title.trim()) {
      toast.error("Event Title is required.");
      return;
    }

    if (!formData.day.trim()) {
      toast.error("Start Day is required.");
      return;
    }

    if (!formData.endDay.trim()) {
      toast.error("End Day is required.");
      return;
    }

    if (!formData.time.trim()) {
      toast.error("Time is required.");
      return;
    }

    if (!formData.location.trim()) {
      toast.error("Location is required.");
      return;
    }

    const eventDate = format(
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        parseInt(formData.day),
      ),
      'yyyy-MM-dd',
    );
    const endDate = format(
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        parseInt(formData.endDay),
      ),
      'yyyy-MM-dd',
    );
    try {
      await createEvent({
        title: formData.title.trim(), event_type: formData.type,
        event_date: eventDate, end_date: endDate, event_time: formData.time,
        location: formData.location, description: '', max_attendees: 10, is_public: true,
      }).unwrap();
    } catch (error) {
      toast.error("Failed to create event.");
      return;
    }
    setIsModalOpen(false);
    setFormData({ title: '', type: 'general', day: '12', endDay: '12', time: '14:00', location: 'Zoom' });
    notifySuccess('Event created successfully!');
  };

  const confirmDeleteEvent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canModify("event", events.find((event) => event.id === id), "delete")) return;
    setDeletingId(id);
    setIsConfirmOpen(true);
  };

  const handleDeleteEvent = async () => {
    if (deletingId && canModify("event", events.find((event) => event.id === deletingId), "delete")) {
      try {
        await deleteEvent(deletingId).unwrap();

        if (selectedEvent?.id === deletingId) {
          setSelectedEvent(null);
          navigate('/events');
        }

        setDeletingId(null);
        setIsConfirmOpen(false);
        notifySuccess('Event deleted successfully!');
      } catch (error) {
        toast.error('Failed to delete event.');
      }
    }
  };

  const handleJoinEvent = () => {
    notifySuccess('Registration recorded!');
  };

  const handleEventClick = (event: ApiEvent) => {
    navigate(`/events/${event.id}`);
  };

  const handleCloseDetails = () => {
    navigate('/events');
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 underline decoration-primary decoration-4 underline-offset-8">Event Calendar</h2>
          <p className="text-slate-500 mt-4 text-sm">Meetings, trainings, and association commissions.</p>
        </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm text-slate-600">
            <Download className="w-4 h-4" /> Export ICS
          </button>
          {canCreateEvent && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-slate-900 rounded-xl text-sm font-bold shadow-sm hover:bg-primary-dark transition-all"
            >
              <CalendarCheck className="w-4 h-4" />
              New Event
            </button>
          )}

      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Calendar Grid */}
        <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
           <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                 <h3 className="text-xl font-bold capitalize text-slate-900">{format(currentMonth, 'MMMM yyyy', { locale: enUS })}</h3>
                 <div className="flex gap-1">
                    <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 hover:bg-slate-200 rounded-lg transition-colors text-slate-400"><ChevronLeft className="w-5 h-5" /></button>
                    <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:bg-slate-200 rounded-lg transition-colors text-slate-400"><ChevronRight className="w-5 h-5" /></button>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-7 border-b border-slate-100">
             {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
               <div key={day} className="py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/20">{day}</div>
             ))}
           </div>

           <div className="grid grid-cols-7 auto-rows-[120px]">
              {days.map((day) => {
                const dayEvents = events.filter(
                  (e) =>
                    isWithinInterval(day, {
                      start: parseISO(e.event_date),
                      end: parseISO(e.end_date || e.event_date),
                    }),
                );
                return (
                  <div key={day.toString()} className={`border-r border-b border-slate-50 p-2 hover:bg-slate-50/50 transition-colors relative ${!isSameMonth(day, currentMonth) ? 'opacity-30' : ''}`}>
                     <span className={`text-sm font-bold ${isToday(day) ? 'w-8 h-8 flex items-center justify-center bg-primary rounded-full shadow-sm text-slate-900' : 'text-slate-400'}`}>
                       {format(day, 'd')}
                     </span>
                     <div className="mt-2 space-y-1 text-slate-900">
                        {dayEvents.map(event => (
                          <div 
                            key={event.id}
                            onClick={() => handleEventClick(event)}
                            className={`text-[9px] font-bold py-1 px-1.5 rounded truncate border shadow-xs group/item flex items-center justify-between overflow-hidden cursor-pointer ${
                              event.event_type === 'training' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                              event.event_type === 'commission' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              event.event_type === 'board' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                              'bg-amber-50 text-amber-700 border-amber-100'
                            }`}
                          >
                             <span className="truncate">{event.title}</span>
                             {canModify("event", event, "delete") && (
                               <button 
                                 onClick={(e) => confirmDeleteEvent(event.id, e)}
                                 className="opacity-0 group-hover/item:opacity-100 bg-white/50 rounded-sm"
                               >
                                 <Trash2 className="w-2 h-2 text-red-500" />
                               </button>
                             )}

                          </div>
                        ))}
                     </div>
                  </div>
                );
              })}
           </div>
        </div>

        {/* Upcoming List */}
        <div className="space-y-6">
           <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm text-slate-900">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">Upcoming</h3>
                <Filter className="w-4 h-4 text-slate-400" />
              </div>
              <div className="space-y-6">
                 {[...events]
                   .sort((a,b) => parseISO(a.event_date).getTime() - parseISO(b.event_date).getTime())
                   .slice(0, 5)
                   .map(event => (
                   <div key={event.id} className="group cursor-pointer" onClick={() => handleEventClick(event)}>
                      <div className="flex gap-4">
                         <div className="flex-shrink-0 w-12 h-12 bg-slate-50 rounded-2xl flex flex-col items-center justify-center border border-slate-100 group-hover:bg-primary group-hover:border-primary transition-colors text-slate-900">
                            <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-900 uppercase tracking-tighter">{format(parseISO(event.event_date), 'MMM', { locale: enUS })}</span>
                            <span className="text-lg font-bold group-hover:text-slate-900 leading-tight">{format(parseISO(event.event_date), 'd')}</span>
                         </div>
                         <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold group-hover:text-primary-dark transition-colors truncate">{event.title}</h4>
                            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3" /> {event.event_time}</p>
                            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> {event.location}</p>
                         </div>
                      </div>
                   </div>
                 ))}
              </div>
           </div>

           <div className="bg-primary/10 border border-primary/20 p-6 rounded-3xl">
              <Users className="w-8 h-8 text-primary-dark mb-3" />
              <h4 className="font-bold text-slate-900 uppercase tracking-tight">Annual General Meeting 2024</h4>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">Don't forget to confirm your presence for the annual meeting on June 15th at Pavillon de l'Arsenal.</p>
              <button 
                onClick={handleJoinEvent}
                className="mt-4 w-full py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 shadow-sm transition-all uppercase tracking-widest"
              >
                Register (Mandatory)
              </button>
           </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen && canCreateEvent} onClose={() => setIsModalOpen(false)} title="Create New Event">
        <form noValidate onSubmit={handleAddEvent} className="space-y-4 text-slate-900">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Event Title</label>
            <input required type="text" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Start Day</label>
              <input required type="number" min="1" max="31" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm" value={formData.day} onChange={e => setFormData({ ...formData, day: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">End Day</label>
              <input required type="number" min="1" max="31" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm" value={formData.endDay} onChange={e => setFormData({ ...formData, endDay: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Time</label>
              <input required type="time" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type</label>
            <select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
              <option value="general">General</option>
              <option value="commission">Commission</option>
              <option value="training">Training</option>
              <option value="board">Administrative</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Location</label>
            <input required type="text" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
          </div>
          <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all mt-4 uppercase tracking-widest shadow-xl">
            Create Event
          </button>
        </form>
      </Modal>

      <ConfirmModal 
        isOpen={isConfirmOpen && canModify("event", events.find((event) => event.id === deletingId), "delete")}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDeleteEvent}
        title="Delete Event"
        message="Are you sure you want to delete this event? This action cannot be undone."
      />

      <Modal
        isOpen={Boolean(eventId && selectedEvent)}
        onClose={handleCloseDetails}
        title="Event Details"
        maxWidth="max-w-3xl"
      >
        {selectedEvent && (
          <div className="flex max-h-[70vh] flex-col text-left text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100">
               <div className="flex gap-6">
                  <button 
                    onClick={() => setActiveTab('info')}
                    className={`pb-3 text-sm font-bold uppercase tracking-widest transition-all relative ${
                      activeTab === 'info' ? 'text-primary-dark' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Details
                    {activeTab === 'info' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />}
                  </button>
                  <button 
                    onClick={() => setActiveTab('participants')}
                    className={`pb-3 text-sm font-bold uppercase tracking-widest transition-all relative ${
                      activeTab === 'participants' ? 'text-primary-dark' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Participants ({selectedEvent.attendee_count})
                    {activeTab === 'participants' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />}
                  </button>
               </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-2 pt-6 custom-scrollbar">
              <AnimatePresence mode="wait">
                {activeTab === 'info' ? (
                  <motion.div 
                    key="info"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-6"
                  >
                  <div className={`w-fit px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        selectedEvent.event_type === 'training' ? 'bg-blue-50 text-blue-700' :
                        selectedEvent.event_type === 'commission' ? 'bg-emerald-50 text-emerald-700' :
                        selectedEvent.event_type === 'board' ? 'bg-purple-50 text-purple-700' :
                        'bg-amber-50 text-amber-700'
                      }`}>
                    {selectedEvent.event_type}
                  </div>
                  
                  <h3 className="text-2xl font-bold leading-tight">{selectedEvent.title}</h3>

                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)] gap-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary-dark border border-slate-200 shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Description</p>
                          <p className="mt-1 text-sm leading-6 text-slate-700">
                            {selectedEvent.description?.trim() || 'No description provided for this event yet.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Max Attendees</p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">
                          {selectedEvent.max_attendees ?? 'N/A'}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Spots Left</p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">
                          {selectedEvent.spots_left ?? 'N/A'}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Visibility</p>
                        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-slate-700 border border-slate-200">
                          <Globe className="w-4 h-4 text-primary-dark" />
                          {selectedEvent.is_public ? 'Public' : 'Private'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                     <div className="flex items-center gap-4 text-slate-600">
                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-primary-dark">
                           <CalendarIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Date</p>
                          <p className="font-bold">
                            {format(parseISO(selectedEvent.event_date), 'EEEE, MMMM d, yyyy', { locale: enUS })}
                            {selectedEvent.end_date && selectedEvent.end_date !== selectedEvent.event_date
                              ? ` - ${format(parseISO(selectedEvent.end_date), 'EEEE, MMMM d, yyyy', { locale: enUS })}`
                              : ''}
                          </p>
                        </div>
                     </div>

                     <div className="flex items-center gap-4 text-slate-600">
                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-primary-dark">
                           <Clock className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Time</p>
                          <p className="font-bold">{selectedEvent.event_time}</p>
                        </div>
                     </div>

                     <div className="flex items-center gap-4 text-slate-600">
                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-primary-dark">
                           <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Location</p>
                          <p className="font-bold">{selectedEvent.location}</p>
                        </div>
                     </div>
                  </div>

                  {selectedEvent.attachments && selectedEvent.attachments.length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Attachments</p>
                      <div className="space-y-2">
                        {selectedEvent.attachments.map((attachment) => (
                          <a
                            key={attachment}
                            href={attachment}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-medium text-slate-700 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                          >
                            <LinkIcon className="w-4 h-4 text-primary-dark shrink-0" />
                            <span className="truncate">{attachment}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  </motion.div>
                ) : (
                  <motion.div 
                    key="participants"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-4"
                  >
                   <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-xs text-slate-500 font-medium">List of members registered for this event. You can register too using the button below.</p>
                   </div>
                   
                   <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {selectedEvent.attendee_count > 0 ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">
                          {selectedEvent.attendee_count} member{selectedEvent.attendee_count === 1 ? '' : 's'} registered for this event.
                        </div>
                      ) : (
                        <div className="py-12 text-center text-slate-400">
                           <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                           <p className="font-medium">No participants yet</p>
                        </div>
                      )}
                   </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-6">
               <button 
                 onClick={() => { handleCloseDetails(); handleJoinEvent(); }}
                 className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all uppercase tracking-widest shadow-xl"
               >
                 Register for this Event
               </button>
               <button 
                 onClick={handleCloseDetails}
                 className="w-full py-4 mt-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all uppercase tracking-widest"
               >
                 Close
               </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
