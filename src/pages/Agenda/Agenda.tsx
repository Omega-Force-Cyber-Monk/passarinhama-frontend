import { ModalFieldGrid, ModalFullWidth, ModalSection, ModalSubmitButton } from "../../components/ui/ModalLayout";
import "../AgendaDocumentModals.css";
import CategoryManagerDialog, { type CategoryValues } from "../../components/ui/CategoryManagerDialog";
import React, { useEffect, useState } from "react";
import {
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  Users,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  CalendarCheck,
  XCircle,
  RefreshCw,
  Edit2,
  FileText,
  Globe,
  Paperclip,
  ExternalLink,
  Grid,
} from "lucide-react";
import TiptapEditor from "../../components/ui/TiptapEditor";
import { motion, AnimatePresence } from "motion/react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  setMonth,
  setYear,
  startOfWeek,
  endOfWeek,
  parse,
  isWithinInterval,
  isBefore,
} from "date-fns";
import Modal from "../../components/ui/Modal";
import ConfirmModal from "../../components/ui/ConfirmModal";
import { useAppToast } from "../../components/ui/AppToastProvider";
import {
  FilePreviewCard,
  FileUploadDropzone,
  getPreviewName,
  SelectedFilesPreview,
} from "../../components/ui/FileUploadPreview";
import { useI18n } from "../../i18n";

import { usePermissions } from "../../hooks/usePermissions";
import {
  useGetEventsQuery,
  useGetUpcomingEventsQuery,
  useGetEventByIdQuery,
  useDeleteEventMutation,
  useCreateEventMutation,
  useUpdateEventMutation,
  useRegisterForEventMutation,
  useUnregisterFromEventMutation,
  useGetEventRegistrationsQuery,
  useGetEventCategoriesQuery,
  useCreateEventCategoryMutation,
  useUpdateEventCategoryMutation,
  useDeleteEventCategoryMutation,
} from "../../redux/features/events/eventsApi";
import { useUploadFileMutation } from "../../redux/features/articles/articlesApi";
import {
  Event as APIEvent,
  CreateEventRequest,
  UpdateEventRequest,
} from "../../redux/features/events/eventTypes";
import { parseISO, isSameDay } from "date-fns";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { getApiErrorDisplayMessage } from "../../utils/apiErrorMessages";
import { getYouTubeEmbedUrl } from "../../utils/youtube";

const YEARS = Array.from({ length: 21 }, (_, i) => 2020 + i);

type EventFormState = CreateEventRequest & {
  existing_attachments: string[];
  new_attachments: File[];
  remove_attachment_urls: string[];
};

const getDefaultEventFormData = (): EventFormState => ({
  title: "",
  event_category_id: "",
  event_date: format(new Date(), "yyyy-MM-dd"),
  end_date: format(new Date(), "yyyy-MM-dd"),
  event_time: "14:00",
  location: "Zoom",
  description: "",
  max_attendees: 50,
  is_public: false,
  attachments: [],
  existing_attachments: [],
  new_attachments: [],
  remove_attachment_urls: [],
});

const isEndDateBeforeStartDate = (startDate: string, endDate: string) =>
  isBefore(
    parse(endDate, "yyyy-MM-dd", new Date()),
    parse(startDate, "yyyy-MM-dd", new Date()),
  );

const getAttachmentName = (value: string) => {
  try {
    return decodeURIComponent(value.split("/").pop() || value);
  } catch {
    return value.split("/").pop() || value;
  }
};

const getAttachmentPreviewType = (url: string) => {
  const cleanUrl = url.split("?")[0].toLowerCase();

  if (/\.(png|jpe?g|gif|webp|svg|avif)$/.test(cleanUrl)) {
    return "image" as const;
  }

  if (/\.(mp4|webm|ogg|mov|m4v)$/.test(cleanUrl)) {
    return "video" as const;
  }

  if (/\.pdf$/.test(cleanUrl)) {
    return "pdf" as const;
  }

  if (/\.(doc|docx|ppt|pptx|xls|xlsx)$/.test(cleanUrl)) {
    return "document" as const;
  }

  return "file" as const;
};

const YOUTUBE_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

const createYouTubeEmbedElement = (doc: Document, embedUrl: string) => {
  const wrapper = doc.createElement("div");
  wrapper.setAttribute("data-youtube-video", "true");
  wrapper.className = "youtube-embed";

  const iframe = doc.createElement("iframe");
  iframe.setAttribute("src", embedUrl);
  iframe.setAttribute("title", "YouTube video player");
  iframe.setAttribute("allow", YOUTUBE_ALLOW);
  iframe.setAttribute("allowfullscreen", "true");
  iframe.setAttribute("frameborder", "0");
  iframe.setAttribute("loading", "lazy");
  iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");

  wrapper.appendChild(iframe);

  return wrapper;
};

const enhanceEventDescription = (content?: string | null) => {
  if (!content?.trim() || typeof window === "undefined") {
    return content || "";
  }

  const doc = new window.DOMParser().parseFromString(content, "text/html");

  doc.querySelectorAll("p").forEach((paragraph) => {
    const text = paragraph.textContent?.trim();

    if (!text) {
      return;
    }

    const embedUrl = getYouTubeEmbedUrl(text);

    if (embedUrl && paragraph.children.length === 0) {
      paragraph.replaceWith(createYouTubeEmbedElement(doc, embedUrl));
    }
  });

  doc.querySelectorAll("a[href]").forEach((anchor) => {
    if (anchor.closest("[data-youtube-video]")) {
      return;
    }

    const href = anchor.getAttribute("href")?.trim() || "";
    const embedUrl = getYouTubeEmbedUrl(href);

    if (!embedUrl) {
      return;
    }

    const parent = anchor.parentElement;
    const parentText = parent?.textContent?.trim();
    const anchorText = anchor.textContent?.trim();

    if (
      parent?.tagName === "P" &&
      parentText &&
      anchorText &&
      parentText === anchorText
    ) {
      parent.replaceWith(createYouTubeEmbedElement(doc, embedUrl));
      return;
    }

    anchor.insertAdjacentElement(
      "afterend",
      createYouTubeEmbedElement(doc, embedUrl),
    );
  });

  return doc.body.innerHTML;
};

export default function Agenda() {
  const { dateLocale, translate } = useI18n();
  const toast = useAppToast();
  const { hasPermission, canModify, canAccessAdminPanel: isSuperuser } = usePermissions();
  const canViewEvent = hasPermission("event", "view");
  const canCreateEvent = hasPermission("event", "create");
  const navigate = useNavigate();
  const { agendaId } = useParams<{ agendaId?: string }>();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const selectedYear = currentMonth.getFullYear();
  const selectedMonth = currentMonth.getMonth() + 1;

  // API Fetching
  const { data: apiEvents, isLoading: isLoadingEvents, isError: isCalendarError } = useGetEventsQuery({
    year: selectedYear,
    month: selectedMonth,
  });
  const {
    data: upcomingEvents,
    isLoading: isLoadingUpcoming,
    isError: isUpcomingError,
  } = useGetUpcomingEventsQuery({ limit: 6 });
  const { data: eventCategoriesResponse, isLoading: isLoadingCategories, error: categoriesError, refetch: refetchCategories } = useGetEventCategoriesQuery({
    pageSize: 100,
  });
  const eventCategories = eventCategoriesResponse?.results ?? [];

  const [createEvent, { isLoading: isCreatingEvent }] =
    useCreateEventMutation();
  const [updateEvent, { isLoading: isUpdatingEvent }] =
    useUpdateEventMutation();
  const [deleteEvent] = useDeleteEventMutation();
  const [createEventCategory] =
    useCreateEventCategoryMutation();
  const [updateEventCategory] =
    useUpdateEventCategoryMutation();
  const [deleteEventCategory] =
    useDeleteEventCategoryMutation();
  const [registerForEvent, { isLoading: isRegistering }] =
    useRegisterForEventMutation();
  const [unregisterFromEvent, { isLoading: isUnregistering }] =
    useUnregisterFromEventMutation();
  const [uploadFile] = useUploadFileMutation();

  const handleImageUpload = async (file: File): Promise<string> => {
    if (isEditMode ? !canModify("event", (apiEvents || []).find((event) => event.id === editingEventId) || (selectedEvent?.id === editingEventId ? selectedEvent : undefined), "edit") : !canCreateEvent) throw new Error("Forbidden");
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await uploadFile({ formData: data, authorization: { feature: "event", resourceId: isEditMode ? editingEventId || undefined : undefined } }).unwrap();
      return response.url;
    } catch (error) {
      toast.error(getApiErrorDisplayMessage(error, translate, "apiErrors.default"));
      throw error;
    }
  };
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const detailEventId = agendaId || selectedEventId || "";
  const selectedEventFromList = (apiEvents || []).find(
    (event) => event.id === detailEventId,
  );
  const {
    data: selectedEventDetails,
    isError: isSelectedEventError,
    isLoading: isLoadingSelectedEvent,
  } =
    useGetEventByIdQuery(detailEventId, {
      skip: !detailEventId || Boolean(selectedEventFromList),
    });
  const selectedEvent = selectedEventFromList || (selectedEventDetails?.id === detailEventId ? selectedEventDetails : undefined);
  const canSeeParticipants = canModify("event", selectedEvent, "edit") || canModify("event", selectedEvent, "delete");
  const { data: registrationsData, isLoading: isLoadingRegistrations } =
    useGetEventRegistrationsQuery(selectedEventId || "", { skip: !selectedEventId || !canSeeParticipants });
  const selectedEventDescription = selectedEvent
    ? enhanceEventDescription(selectedEvent.description)
    : "";
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<EventFormState>(
    getDefaultEventFormData,
  );
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "participants">("info");
  const [dayViewModal, setDayViewModal] = useState<{
    isOpen: boolean;
    date: Date | null;
    events: APIEvent[];
  }>({
    isOpen: false,
    date: null,
    events: [],
  });

  useEffect(() => {
    if (formData.event_category_id || !eventCategories.length) {
      return;
    }

    setFormData((current) => ({
      ...current,
      event_category_id: eventCategories[0].id,
    }));
  }, [eventCategories, formData.event_category_id]);
  const notifySuccess = (
    msg: string = translate("agendaPage.operationSuccessful"),
  ) => {
    toast.success(msg);
  };

  const weekdayLabels = [
    translate("agendaPage.weekdayMon"),
    translate("agendaPage.weekdayTue"),
    translate("agendaPage.weekdayWed"),
    translate("agendaPage.weekdayThu"),
    translate("agendaPage.weekdayFri"),
    translate("agendaPage.weekdaySat"),
    translate("agendaPage.weekdaySun"),
  ];
  const pickerWeekdayLabels = eachDayOfInterval({
    start: startOfWeek(new Date()),
    end: endOfWeek(new Date()),
  }).map((day) => format(day, "EEE", { locale: dateLocale }));

  const getEventCategory = (event?: APIEvent | null) =>
    event?.event_category ||
    eventCategories.find((category) => category.id === event?.event_category_id) ||
    null;

  const getEventCategoryLabel = (event?: APIEvent | null) =>
    getEventCategory(event)?.name ||
    event?.event_type ||
    translate("agendaPage.eventTypeGeneral");

  const getEventCategoryStyle = (event?: APIEvent | null) => {
    const color = getEventCategory(event)?.color_code || "#F2C41E";
    return {
      backgroundColor: `${color}1A`,
      borderColor: `${color}55`,
      color,
    };
  };

  const calendarStart = startOfWeek(startOfMonth(currentMonth), {
    weekStartsOn: 1,
  });
  const calendarEnd = endOfWeek(endOfMonth(currentMonth), {
    weekStartsOn: 1,
  });
  const days = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  useEffect(() => {
    if (!agendaId) {
      setSelectedEventId(null);
      return;
    }

    const matchedEvent = (apiEvents || []).find((event) => event.id === agendaId);

    if (matchedEvent) {
      setSelectedEventId(matchedEvent.id);
      setActiveTab("info");
      return;
    }

    if (
      !isLoadingEvents &&
      !isLoadingSelectedEvent &&
      isSelectedEventError &&
      !selectedEventDetails
    ) {
      navigate("/agenda", { replace: true });
      return;
    }

    if (selectedEventDetails) {
      setSelectedEventId(selectedEventDetails.id);
      setActiveTab("info");
    }
  }, [
    agendaId,
    apiEvents,
    isLoadingEvents,
    isLoadingSelectedEvent,
    isSelectedEventError,
    navigate,
    selectedEventDetails,
  ]);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    if ((isEditMode && !canModify("event", (apiEvents || []).find((event) => event.id === editingEventId) || (selectedEvent?.id === editingEventId ? selectedEvent : undefined), "edit")) || (!isEditMode && !canCreateEvent)) {
      return;
    }

    const requireField = (fieldLabel: string) => {
      const message = translate("common.requiredField", { field: fieldLabel });
      toast.error(message);
    };

    if (!formData.title.trim()) {
      requireField(translate("agendaPage.eventTitle"));
      return;
    }

    if (!formData.event_date) {
      requireField(translate("agendaPage.startDate"));
      return;
    }

    if (!formData.end_date) {
      requireField(translate("agendaPage.endDate"));
      return;
    }

    if (!formData.event_time) {
      requireField(translate("agendaPage.eventTime"));
      return;
    }

    if (!formData.event_category_id) {
      requireField(translate("agendaPage.eventType"));
      return;
    }

    if (!formData.location.trim()) {
      requireField(translate("agendaPage.location"));
      return;
    }

    if (isEndDateBeforeStartDate(formData.event_date, formData.end_date)) {
      const message = translate("agendaPage.invalidDateRange");
      toast.error(message);
      return;
    }

    try {
      if (isEditMode && editingEventId) {
        const payload: UpdateEventRequest = {
          title: formData.title,
          event_category_id: formData.event_category_id,
          event_date: formData.event_date,
          end_date: formData.end_date,
          event_time: formData.event_time,
          location: formData.location,
          description: formData.description,
          max_attendees: formData.max_attendees,
          is_public: formData.is_public,
          status: formData.status,
          new_attachments: formData.new_attachments,
          remove_attachment_urls: formData.remove_attachment_urls,
        };

        await updateEvent({ id: editingEventId, data: payload }).unwrap();
        notifySuccess(translate("agendaPage.eventUpdatedSuccess"));
        navigate(`/agenda/${editingEventId}`);
      } else {
        const payload: CreateEventRequest = {
          title: formData.title,
          event_category_id: formData.event_category_id,
          event_date: formData.event_date,
          end_date: formData.end_date,
          event_time: formData.event_time,
          location: formData.location,
          description: formData.description,
          max_attendees: formData.max_attendees,
          is_public: formData.is_public,
          status: formData.status,
          attachments: formData.attachments,
        };

        await createEvent(payload).unwrap();
        notifySuccess(translate("agendaPage.eventCreatedSuccess"));
      }

      setIsModalOpen(false);
      setIsEditMode(false);
      setEditingEventId(null);
      setFormData(getDefaultEventFormData());
    } catch (err) {
      const message = getApiErrorDisplayMessage(
        err,
        translate,
        "apiErrors.default",
      );
      toast.error(message);
    }
  };

  const handleCreateAttachmentsChange = (files: File[]) => {
    setFormData((prev) => ({
      ...prev,
      attachments: [...(prev.attachments || []), ...files],
    }));
  };

  const handleNewAttachmentsChange = (files: File[]) => {
    setFormData((prev) => ({
      ...prev,
      new_attachments: [...(prev.new_attachments || []), ...files],
    }));
  };

  const removeCreateAttachment = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      attachments: (prev.attachments || []).filter((_, idx) => idx !== index),
    }));
  };

  const removeNewAttachment = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      new_attachments: prev.new_attachments.filter((_, idx) => idx !== index),
    }));
  };

  const removeExistingAttachment = (url: string) => {
    setFormData((prev) => ({
      ...prev,
      existing_attachments: prev.existing_attachments.filter(
        (attachmentUrl) => attachmentUrl !== url,
      ),
      remove_attachment_urls: prev.remove_attachment_urls.includes(url)
        ? prev.remove_attachment_urls
        : [...prev.remove_attachment_urls, url],
    }));
  };

  const openCreateModal = () => {
    if (!canCreateEvent) return;

    setIsEditMode(false);
    setEditingEventId(null);
    setFormData(getDefaultEventFormData());
    setIsModalOpen(true);
  };

  const openEditModal = (event: APIEvent) => {
    if (!canModify("event", event, "edit")) return;

    setIsEditMode(true);
    setEditingEventId(event.id);
    navigate("/agenda");
    setFormData({
      title: event.title,
      event_category_id: event.event_category?.id || event.event_category_id || "",
      event_date: event.event_date,
      end_date: event.end_date || event.event_date,
      event_time: event.event_time,
      location: event.location,
      description: event.description,
      max_attendees: event.max_attendees,
      is_public: event.is_public,
      status: event.status,
      attachments: [],
      existing_attachments: event.attachments || [],
      new_attachments: [],
      remove_attachment_urls: [],
    });
    setIsModalOpen(true);
  };

  const confirmDeleteEvent = (id: string) => {
    if (!canModify("event", (apiEvents || []).find((event) => event.id === id) || (selectedEvent?.id === id ? selectedEvent : undefined), "delete")) return;

    setDeletingId(id);
    setIsConfirmOpen(true);
  };

  const handleDeleteEvent = async () => {
    if (deletingId && canModify("event", (apiEvents || []).find((event) => event.id === deletingId) || (selectedEvent?.id === deletingId ? selectedEvent : undefined), "delete")) {
      try {
        await deleteEvent(deletingId).unwrap();
        if (selectedEventId === deletingId) {
          setSelectedEventId(null);
          navigate("/agenda");
        }
        setDeletingId(null);
        setIsConfirmOpen(false);
        notifySuccess(translate("agendaPage.eventDeletedSuccess"));
      } catch (err) {
        toast.error(getApiErrorDisplayMessage(err, translate, "apiErrors.default"));
      }
    }
  };

  const handleToggleRegistration = async (
    id: string,
    isRegistered: boolean,
  ) => {
    if (!canViewEvent) return;
    try {
      if (isRegistered) {
        await unregisterFromEvent(id).unwrap();
        notifySuccess(translate("agendaPage.unregisteredSuccess"));
      } else {
        await registerForEvent(id).unwrap();
        notifySuccess(translate("agendaPage.registeredSuccess"));
      }
    } catch (err) {
      toast.error(getApiErrorDisplayMessage(err, translate, "apiErrors.default"));
    }
  };

  const handleEventClick = (event: APIEvent) => {
    navigate(`/agenda/${event.id}`);
  };

  const handleCloseDetails = () => {
    navigate("/agenda");
  };

  const BeautifulDateTimePicker = ({
    label,
    value,
    onChange,
    type,
    icon,
    minDate,
  }: {
    label: string;
    value: string;
    onChange: (val: string) => void;
    type: "date" | "time";
    icon: React.ReactNode;
    minDate?: string;
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());
    const pickerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          pickerRef.current &&
          !pickerRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
        }
      };
      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
      }
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    const renderCalendar = () => {
      const start = startOfWeek(startOfMonth(viewDate));
      const end = endOfWeek(endOfMonth(viewDate));
      const days = eachDayOfInterval({ start, end });

      return (
        <div className="p-4 w-72 bg-white rounded-3xl shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
          <div className="flex items-center justify-between mb-4 px-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setViewDate(subMonths(viewDate, 1));
              }}
              className="p-2 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-900">
              {format(viewDate, "MMMM yyyy", { locale: dateLocale })}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setViewDate(addMonths(viewDate, 1));
              }}
              className="p-2 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {pickerWeekdayLabels.map((day) => (
              <div
                key={day}
                className="text-[8px] font-black text-slate-300 uppercase tracking-widest text-center py-2"
              >
                {day}
              </div>
            ))}
            {days.map((day, idx) => {
              const isSelected =
                value && isSameDay(day, parse(value, "yyyy-MM-dd", new Date()));
              const isCurrentMonth = isSameMonth(day, viewDate);
              const isDisabled =
                type === "date" &&
                minDate &&
                isBefore(day, parse(minDate, "yyyy-MM-dd", new Date())) &&
                !isSameDay(day, parse(minDate, "yyyy-MM-dd", new Date()));
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isDisabled) {
                      return;
                    }
                    onChange(format(day, "yyyy-MM-dd"));
                    setIsOpen(false);
                  }}
                  disabled={Boolean(isDisabled)}
                  className={`
                    h-8 w-8 rounded-xl text-[10px] font-bold transition-all cursor-pointer
                    ${isSelected ? "bg-primary text-slate-900 shadow-lg scale-110" : "hover:bg-slate-50 text-slate-600"}
                    ${!isCurrentMonth && !isSelected ? "opacity-20" : ""}
                    ${isDisabled ? "cursor-not-allowed opacity-20 hover:bg-transparent" : ""}
                  `}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>
        </div>
      );
    };

    const renderTimePicker = () => {
      const hours = Array.from({ length: 24 }, (_, i) =>
        i.toString().padStart(2, "0"),
      );
      const minutes = ["00", "15", "30", "45"];

      return (
        <div className="p-4 w-64 bg-white rounded-3xl shadow-2xl border border-slate-100 flex gap-4 max-h-72 overflow-hidden">
          <div className="flex-1 overflow-y-auto pr-2 space-y-1 custom-scrollbar">
            <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-2 px-2">
              {translate("agendaPage.hour")}
            </div>
            {hours.map((h) => (
              <button
                key={h}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const [_, m = "00"] = value.split(":");
                  onChange(`${h}:${m}`);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                  value.startsWith(h + ":")
                    ? "bg-primary text-slate-900"
                    : "hover:bg-slate-50 text-slate-600"
                }`}
              >
                {h}:00
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
            <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-2 px-2">
              {translate("agendaPage.minute")}
            </div>
            {minutes.map((m) => (
              <button
                key={m}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const [h = "00"] = value.split(":");
                  onChange(`${h}:${m}`);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                  value.endsWith(":" + m)
                    ? "bg-primary text-slate-900"
                    : "hover:bg-slate-50 text-slate-600"
                }`}
              >
                :{m}
              </button>
            ))}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-2 relative" ref={pickerRef}>
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
          {label}
        </label>
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="relative group cursor-pointer"
        >
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none group-hover:scale-110 transition-transform">
            {icon}
          </div>
          <div className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm transition-all hover:bg-white flex items-center min-h-[46px]">
            {value ? (
              type === "date" ? (
                format(parse(value, "yyyy-MM-dd", new Date()), "PPP", {
                  locale: dateLocale,
                })
              ) : (
                value
              )
            ) : (
              <span className="text-slate-300">
                {translate("agendaPage.selectLabel", { label })}
              </span>
            )}
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
            <Plus className="w-3 h-3 rotate-45" />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute z-[100] mt-2 left-0 origin-top-left"
            >
              {type === "date" ? renderCalendar() : renderTimePicker()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const handleMonthChange = (monthIndex: number) => {
    setCurrentMonth(setMonth(currentMonth, monthIndex));
  };

  const handleYearChange = (year: number) => {
    setCurrentMonth(setYear(currentMonth, year));
  };

  const handleCreateCategory = async (values: CategoryValues) => {
    if (!isSuperuser) return;
    await createEventCategory(values).unwrap();
    notifySuccess();
  };

  const handleUpdateCategory = async (id: string, values: CategoryValues) => {
    if (!isSuperuser) return;
    await updateEventCategory({ id, ...values }).unwrap();
    notifySuccess();
  };

  const handleDeleteCategory = async (id: string) => {
    if (!isSuperuser) return;
    await deleteEventCategory(id).unwrap();
    if (formData.event_category_id === id) {
      setFormData((current) => ({ ...current, event_category_id: eventCategories.find((category) => category.id !== id)?.id || "" }));
    }
    notifySuccess();
  };

  if (!canViewEvent) {
    return <Navigate to="/" replace state={{ accessRestricted: true }} />;
  }

  return (
    <div className="agenda-page">
      <header className="agenda-page-header">
        <div>
          <h2 className="agenda-page-title font-bold tracking-tight text-slate-900 underline decoration-primary decoration-4 underline-offset-8">
            {translate("agendaPage.title")}
          </h2>
          {/* <p className="text-slate-500 mt-4 text-sm">
            {translate("agendaPage.description")}
          </p> */}
        </div>
        <div className="agenda-page-actions">
          {isSuperuser && <button
            onClick={() => { if (isSuperuser) setIsCategoryModalOpen(true); }}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-2 text-sm font-bold text-slate-900 shadow-sm transition-all hover:bg-slate-50 cursor-pointer"
          >
            <Grid className="w-4 h-4 text-primary" />
            {translate("agendaPage.categories")}
          </button>}
          {canCreateEvent && (
            <button
              onClick={openCreateModal}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2 text-sm font-bold text-slate-900 shadow-sm transition-all hover:bg-primary-dark cursor-pointer"
            >
              <CalendarCheck className="w-4 h-4" />
              {translate("agendaPage.newEvent")}
            </button>
          )}
        </div>
      </header>

      <div className="agenda-main-layout">
        {/* Agenda Grid */}
        <div className="agenda-calendar bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="agenda-calendar-toolbar border-b border-slate-100 bg-slate-50/50">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
                <select
                  value={currentMonth.getMonth()}
                  onChange={(e) => handleMonthChange(parseInt(e.target.value))}
                  aria-label={translate("agendaPage.month")}
                  className="bg-transparent border-none outline-none text-sm font-bold text-slate-900 cursor-pointer"
                >
                  {Array.from({ length: 12 }, (_, index) => (
                    <option key={index} value={index}>
                      {format(setMonth(new Date(), index), "MMMM", {
                        locale: dateLocale,
                      })}
                    </option>
                  ))}
                </select>
                <select
                  value={currentMonth.getFullYear()}
                  onChange={(e) => handleYearChange(parseInt(e.target.value))}
                  aria-label={translate("agendaPage.year")}
                  className="bg-transparent border-none outline-none text-sm font-bold text-slate-900 cursor-pointer"
                >
                  {YEARS.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  aria-label={translate("agendaPage.previousMonth")}
                  className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400 bg-white border border-slate-100 shadow-sm cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  aria-label={translate("agendaPage.nextMonth")}
                  className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400 bg-white border border-slate-100 shadow-sm cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
              {format(currentMonth, "MMMM yyyy", { locale: dateLocale })}
            </div>
          </div>

          <div className="relative">
            {isLoadingEvents && (
              <div className="absolute inset-0 z-20 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-white rounded-3xl shadow-xl flex items-center justify-center border border-slate-100">
                    <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 animate-pulse">
                    {translate("agendaPage.syncingAgenda")}
                  </p>
                </div>
              </div>
            )}
            {isCalendarError ? <p role="alert" className="m-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{translate("agendaPage.failedToLoadEvents")}</p> : null}
            <table className="agenda-month-table" aria-label={format(currentMonth, "MMMM yyyy", { locale: dateLocale })} aria-busy={isLoadingEvents}>
              <thead><tr>
                {weekdayLabels.map((label) => <th key={label} scope="col">
                  <span className="agenda-calendar-desktop">{label}</span>
                  <abbr className="agenda-calendar-mobile no-underline" title={label}>{label.slice(0, 1)}</abbr>
                </th>)}
              </tr></thead>
              <tbody>
                {Array.from({ length: days.length / 7 }, (_, week) => <tr key={week}>
                  {days.slice(week * 7, week * 7 + 7).map((day) => {
                    const dayEvents = (apiEvents || []).filter((event) => isWithinInterval(day, {
                      start: parseISO(event.event_date), end: parseISO(event.end_date || event.event_date),
                    }));
                    const dayLabel = format(day, "PPPP", { locale: dateLocale });
                    const openDay = () => setDayViewModal({ isOpen: true, date: day, events: dayEvents });
                    return <td key={day.toISOString()} className={!isSameMonth(day, currentMonth) ? "text-slate-400 bg-slate-50/50" : "text-slate-900"}>
                      <time dateTime={format(day, "yyyy-MM-dd")} title={dayLabel} aria-current={isToday(day) ? "date" : undefined} className={
                        "agenda-day-number" + (isToday(day) ? " bg-primary text-slate-900" : " text-slate-500")
                      }>{format(day, "d")}</time>
                      {dayEvents.length ? <>
                        <div className="agenda-calendar-desktop mt-1 space-y-1">
                          <button type="button" onClick={() => handleEventClick(dayEvents[0])} style={getEventCategoryStyle(dayEvents[0])} className="block w-full min-w-0 truncate rounded border px-1.5 py-1 text-left text-[10px] font-semibold" title={dayEvents[0].title}>
                            {dayEvents[0].title}
                          </button>
                          {dayEvents.length > 1 ? <button type="button" onClick={openDay} className="block w-full truncate rounded border border-slate-100 bg-slate-50 py-1 text-[10px] font-bold text-slate-500 hover:bg-primary/20" aria-label={translate("agendaPage.eventsOnDate", { count: dayEvents.length, date: dayLabel })}>
                            {translate("agendaPage.calendarMore", { count: dayEvents.length - 1 })}
                          </button> : null}
                        </div>
                        <button type="button" onClick={openDay} className="agenda-calendar-mobile agenda-day-count" style={getEventCategoryStyle(dayEvents[0])} aria-label={translate("agendaPage.eventsOnDate", { count: dayEvents.length, date: dayLabel })}>
                          {dayEvents.length}
                        </button>
                      </> : null}
                    </td>;
                  })}
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>

        {/* Upcoming List */}
        <div className="min-w-0">
          <div className="agenda-upcoming-panel bg-white rounded-3xl border border-slate-200 shadow-sm text-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className="text-lg font-bold">
                {translate("agendaPage.upcoming")}
              </h3>
            </div>

            {/* Upcoming event items */}
            <div className="space-y-4">
              {isLoadingUpcoming ? (
                // Skeleton Loader
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-4 animate-pulse">
                    <div className="flex-shrink-0 w-12 h-12 bg-slate-100 rounded-2xl" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-4 bg-slate-100 rounded w-3/4" />
                      <div className="h-3 bg-slate-100 rounded w-1/2" />
                    </div>
                  </div>
                ))
              ) : isUpcomingError ? (
                <div className="py-8 text-center text-red-400 bg-red-50/50 rounded-2xl border border-red-100">
                  <XCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">
                    {translate("agendaPage.failedToLoadEvents")}
                  </p>
                </div>
              ) : upcomingEvents && upcomingEvents.length > 0 ? (
                upcomingEvents.map((event) => {
                  const eDate = parseISO(event.event_date);
                  return (
                    <motion.button
                      type="button"
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={event.id}
                      className="group block w-full min-w-0 cursor-pointer text-left"
                      onClick={() => handleEventClick(event)}
                    >
                      <div className="flex gap-3">
                        <div className="agenda-upcoming-date flex-shrink-0 bg-slate-50 rounded-2xl flex flex-col items-center justify-center border border-slate-100 group-hover:bg-primary group-hover:border-primary transition-colors text-slate-900">
                          <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-900 uppercase tracking-tighter">
                            {format(eDate, "MMM", { locale: dateLocale })}
                          </span>
                          <span className="text-lg font-bold group-hover:text-slate-900 leading-tight">
                            {format(eDate, "d")}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold group-hover:text-primary-dark transition-colors line-clamp-2 break-words">
                            {event.title}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3 shrink-0" /><span className="min-w-0 break-words">{event.event_time}</span>
                          </p>
                          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3 shrink-0" /><span className="min-w-0 line-clamp-2 break-words">{event.location}</span>
                          </p>
                        </div>
                      </div>
                    </motion.button>
                  );
                })
              ) : (
                <div className="py-12 text-center text-slate-400 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                  <CalendarIcon className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1">
                    {translate("agendaPage.quietHorizon")}
                  </p>
                  <p className="text-[9px] font-medium italic">
                    {translate("agendaPage.noUpcomingEvents")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen && (isEditMode ? canModify("event", (apiEvents || []).find((event) => event.id === editingEventId) || (selectedEvent?.id === editingEventId ? selectedEvent : undefined), "edit") : canCreateEvent)}
        onClose={() => {
          setIsModalOpen(false);
          setIsEditMode(false);
          setEditingEventId(null);
          setFormData(getDefaultEventFormData());
        }}
        title={
          isEditMode
            ? translate("Edit")
            : translate("agendaPage.createNewEvent")
        }
        layout="compact"
        className="batch-three-modal agenda-event-editor"
        footer={(<ModalSubmitButton
          formId="agenda-event-form"
          disabled={isCreatingEvent || isUpdatingEvent}
          className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isCreatingEvent || isUpdatingEvent ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              {translate("agendaPage.syncingToNexus")}
            </>
          ) : (
            isEditMode ? translate("Edit") : translate("agendaPage.createEvent")
          )}
        </ModalSubmitButton>)}>
        <form
          id="agenda-event-form"
          noValidate
          onSubmit={handleAddEvent}
          className="space-y-4 text-slate-900">
          <ModalFieldGrid>
            <ModalFullWidth>
              <div className="space-y-2">
                <label htmlFor="agenda-event-field-1" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {translate("agendaPage.eventTitle")}
                </label>
                <input
                  id="agenda-event-field-1"
                  required
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                />
              </div>
            </ModalFullWidth>
            <BeautifulDateTimePicker
              label={translate("agendaPage.startDate")}
              type="date"
              value={formData.event_date}
              onChange={(val) =>
                setFormData((prev) => ({
                  ...prev,
                  event_date: val,
                  end_date: isEndDateBeforeStartDate(val, prev.end_date)
                    ? val
                    : prev.end_date,
                }))
              }
              icon={<CalendarIcon className="w-4 h-4 text-primary" />}
            />
            <BeautifulDateTimePicker
              label={translate("agendaPage.endDate")}
              type="date"
              value={formData.end_date}
              onChange={(val) => {
                setFormData({ ...formData, end_date: val });
              }}
              icon={<CalendarIcon className="w-4 h-4 text-primary" />}
              minDate={formData.event_date}
            />
            <BeautifulDateTimePicker
              label={translate("agendaPage.eventTime")}
              type="time"
              value={formData.event_time}
              onChange={(val) => setFormData({ ...formData, event_time: val })}
              icon={<Clock className="w-4 h-4 text-primary" />}
            />
            <div className="space-y-2">
              <label htmlFor="agenda-event-field-2" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                {translate("agendaPage.eventType")}
              </label>
              <select
                id="agenda-event-field-2"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 outline-none font-bold text-sm transition-all"
                value={formData.event_category_id || ""}
                onChange={(e) =>
                  setFormData({ ...formData, event_category_id: e.target.value })
                }
              >
                <option value="">{translate("articlesPage.selectCategory")}</option>
                {eventCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="agenda-event-field-3" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                {translate("agendaPage.maxAttendees")}
              </label>
              <input
                id="agenda-event-field-3"
                type="number"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 outline-none font-bold text-sm transition-all"
                value={formData.max_attendees}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    max_attendees: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
            <ModalFullWidth>
              <div className="space-y-2">
                <label htmlFor="agenda-event-field-4" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {translate("agendaPage.location")}
                </label>
                <input
                  id="agenda-event-field-4"
                  required
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                />
              </div>
            </ModalFullWidth>
            <ModalFullWidth>
              <div
                role="group"
                aria-labelledby="agenda-event-description-label"
                className="space-y-2">
                <label id="agenda-event-description-label" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {translate("agendaPage.descriptionLabel")}
                </label>
                <TiptapEditor
                  content={formData.description}
                  onChange={(content) =>
                    setFormData({ ...formData, description: content })
                  }
                  placeholder={translate("agendaPage.descriptionPlaceholder")}
                  onImageUpload={handleImageUpload}
                />
              </div>
            </ModalFullWidth>
            <ModalFullWidth>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {isEditMode
                    ? translate("agendaPage.newAttachments")
                    : translate("agendaPage.attachments")}
                </label>
                <FileUploadDropzone
                  presentation="compact"
                  inputId={`agenda-attachments-${isEditMode ? "edit" : "create"}`}
                  title={translate("agendaPage.addFiles")}
                  hint={
                    isEditMode
                      ? translate("agendaPage.uploadNewFilesForThisEvent")
                      : translate("agendaPage.uploadFilesForThisEvent")
                  }
                  selectedLabel={
                    (isEditMode ? formData.new_attachments.length : formData.attachments?.length)
                      ? translate("agendaPage.filesSelected", {
                        count:
                          isEditMode
                            ? formData.new_attachments.length
                            : formData.attachments?.length || 0,
                      })
                      : undefined
                  }
                  onFilesSelected={(files) =>
                    isEditMode
                      ? handleNewAttachmentsChange(files)
                      : handleCreateAttachmentsChange(files)
                  }
                  preview={(isEditMode ? formData.new_attachments.length : formData.attachments?.length) ? (<SelectedFilesPreview
                    presentation="compact"
                    files={isEditMode ? formData.new_attachments : formData.attachments || []}
                    onRemove={(index) =>
                      isEditMode ? removeNewAttachment(index) : removeCreateAttachment(index)
                    }
                  />) : undefined}
                />
                {isEditMode && formData.existing_attachments.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {translate("agendaPage.existingAttachments")}
                    </div>
                    <ModalFieldGrid>
                      {formData.existing_attachments.map((attachmentUrl) => (
                        <FilePreviewCard
                          presentation="compact"
                          key={attachmentUrl}
                          url={attachmentUrl}
                          href={attachmentUrl}
                          name={getPreviewName(attachmentUrl)}
                          subtitle={translate("agendaPage.openFile")}
                          onRemove={() => removeExistingAttachment(attachmentUrl)}
                        />
                      ))}
                    </ModalFieldGrid>
                  </div>
                )}
              </div>
            </ModalFullWidth>
            <ModalFullWidth>
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="is_public"
                  className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary"
                  checked={formData.is_public}
                  onChange={(e) =>
                    setFormData({ ...formData, is_public: e.target.checked })
                  }
                />
                <label
                  htmlFor="is_public"
                  className="text-xs font-bold text-slate-700 uppercase tracking-widest cursor-pointer"
                >
                  {translate("agendaPage.publicEvent")}
                </label>
              </div>
            </ModalFullWidth>
          </ModalFieldGrid>
        </form>
      </Modal>
      <ConfirmModal
        presentation="compact"
        isOpen={isConfirmOpen && canModify("event", (apiEvents || []).find((event) => event.id === deletingId) || (selectedEvent?.id === deletingId ? selectedEvent : undefined), "delete")}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDeleteEvent}
        title={translate("agendaPage.deleteEvent")}
        message={translate("agendaPage.deleteEventMessage")}
      />
      {/* Event Details Modal */}
      <Modal
        isOpen={Boolean(agendaId && selectedEvent)}
        onClose={handleCloseDetails}
        title={translate("agendaPage.eventDetails")}
        layout="drawer"
        className="batch-three-modal agenda-detail-drawer"
        footer={selectedEvent ? (<div className="batch-three-actions">
          <div className="batch-three-action-row">
            {canModify("event", selectedEvent, "edit") ? (
              <button
                onClick={() => openEditModal(selectedEvent)}
                className="w-full py-3 sm:flex-1 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer"
              >
                <Edit2 className="w-4 h-4" />
                {translate("Edit")}
              </button>
            ) : null}
            {canModify("event", selectedEvent, "delete") ? (
              <button
                onClick={() => confirmDeleteEvent(selectedEvent.id)}
                className="w-full py-3 sm:flex-1 bg-red-50 border border-red-100 text-red-600 rounded-xl font-bold text-xs hover:bg-red-100 transition-all uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                {translate("agendaPage.deleteEvent")}
              </button>
            ) : null}
            {selectedEvent.is_registered ? (
              <button
                disabled={isUnregistering || isRegistering}
                onClick={() =>
                  handleToggleRegistration(selectedEvent.id, true)
                }
                className="w-full py-3 sm:flex-1 bg-red-50 text-red-600 rounded-xl font-bold text-xs hover:bg-red-100 transition-all uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isUnregistering ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {translate("agendaPage.unregistering")}
                  </>
                ) : (
                  translate("agendaPage.unregisterFromEvent")
                )}
              </button>
            ) : (
              <button
                disabled={
                  isRegistering ||
                  isUnregistering ||
                  (selectedEvent.attendee_count >=
                    selectedEvent.max_attendees &&
                    !selectedEvent.is_registered)
                }
                onClick={() =>
                  handleToggleRegistration(selectedEvent.id, false)
                }
                className="w-full py-3 sm:flex-1 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer"
              >
                {isRegistering ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {translate("agendaPage.registering")}
                  </>
                ) : selectedEvent.attendee_count >=
                  selectedEvent.max_attendees &&
                  !selectedEvent.is_registered ? (
                  translate("agendaPage.eventAtCapacity")
                ) : (
                  translate("agendaPage.registerForEvent")
                )}
              </button>
            )}
          </div>
        </div>) : undefined}
      >
        {selectedEvent && (
          <div className="space-y-4 text-slate-900 text-left">
            <div className="flex items-center justify-between border-b border-slate-100">
              <div className="agenda-detail-tabs flex gap-6">
                <button
                  onClick={() => setActiveTab("info")}
                  className={`pb-3 text-sm font-bold uppercase tracking-widest transition-all relative cursor-pointer ${activeTab === "info"
                      ? "text-primary-dark"
                      : "text-slate-400 hover:text-slate-600"
                    }`}
                >
                  {translate("agendaPage.details")}
                  {activeTab === "info" && (
                    <motion.div
                      layoutId="tab-underline"
                      className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full"
                    />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("participants")}
                  className={`pb-3 text-sm font-bold uppercase tracking-widest transition-all relative cursor-pointer ${activeTab === "participants"
                      ? "text-primary-dark"
                      : selectedEvent.attendee_count >=
                        selectedEvent.max_attendees
                        ? "text-red-500 hover:text-red-600"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                >
                  {translate("agendaPage.participants", {
                    count: selectedEvent.attendee_count,
                  })}
                  {activeTab === "participants" && (
                    <motion.div
                      layoutId="tab-underline"
                      className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full"
                    />
                  )}
                </button>
              </div>
            </div>
            <AnimatePresence mode="wait">
              {activeTab === "info" ? (
                <motion.div
                  key="info"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-4"
                >
                  <div
                    style={getEventCategoryStyle(selectedEvent)}
                    className="w-fit px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                  >
                    {getEventCategoryLabel(selectedEvent)}
                  </div>
                  <h3 className="text-2xl font-bold leading-tight">
                    {selectedEvent.title}
                  </h3>
                  <ModalSection title={translate("agendaPage.descriptionLabel")}>
                    {selectedEventDescription.trim() ? (
                      <div
                        className="mt-4 text-sm leading-7 text-slate-700 prose prose-slate max-w-none prose-p:text-slate-700 prose-headings:text-slate-900 prose-strong:text-slate-900 prose-a:text-primary prose-a:break-all prose-ul:list-disc prose-ol:list-decimal prose-li:marker:text-slate-400 [&_.youtube-embed]:relative [&_.youtube-embed]:my-6 [&_.youtube-embed]:overflow-hidden [&_.youtube-embed]:rounded-[24px] [&_.youtube-embed]:border [&_.youtube-embed]:border-slate-200 [&_.youtube-embed]:bg-slate-950 [&_.youtube-embed]:pt-[56.25%] [&_.youtube-embed_iframe]:absolute [&_.youtube-embed_iframe]:left-0 [&_.youtube-embed_iframe]:top-0 [&_.youtube-embed_iframe]:h-full [&_.youtube-embed_iframe]:w-full"
                        dangerouslySetInnerHTML={{
                          __html: selectedEventDescription,
                        }}
                      />
                    ) : (
                      <p className="mt-4 text-sm italic leading-7 text-slate-400">
                        -
                      </p>
                    )}
                  </ModalSection>
                  <ModalFieldGrid>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                        {translate("agendaPage.maxAttendees")}
                      </p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">
                        {selectedEvent.max_attendees}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                        {translate("agendaPage.spotsLeft")}
                      </p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">
                        {selectedEvent.spots_left}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                        {translate("agendaPage.visibility")}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 border border-slate-200">
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {selectedEvent.is_public
                              ? translate("public")
                              : translate("private")}
                          </p>
                          <p className="text-xs text-slate-500">
                            {selectedEvent.is_public
                              ? translate("agendaPage.visibilityPublicHint")
                              : translate("agendaPage.visibilityPrivateHint")}
                          </p>
                        </div>
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full ${selectedEvent.is_public
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-slate-100 text-slate-500"
                            }`}
                        >
                          <Globe className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </ModalFieldGrid>
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-4 text-slate-600">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-primary-dark">
                        <CalendarIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">
                          {translate("agendaPage.date")}
                        </p>
                        <p className="font-bold">
                          {selectedEvent.end_date &&
                            selectedEvent.end_date !== selectedEvent.event_date
                            ? `${format(parseISO(selectedEvent.event_date), "EEEE, MMMM d, yyyy", {
                              locale: dateLocale,
                            })} - ${format(parseISO(selectedEvent.end_date), "EEEE, MMMM d, yyyy", {
                              locale: dateLocale,
                            })}`
                            : format(
                              parseISO(selectedEvent.event_date),
                              "EEEE, MMMM d, yyyy",
                              { locale: dateLocale },
                            )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-slate-600">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-primary-dark">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">
                          {translate("agendaPage.time")}
                        </p>
                        <p className="font-bold">{selectedEvent.event_time}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-slate-600">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-primary-dark">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">
                          {translate("agendaPage.location")}
                        </p>
                        <p className="font-bold">{selectedEvent.location}</p>
                      </div>
                    </div>
                  </div>
                  <ModalSection title={translate("agendaPage.attachments")}>

                    {selectedEvent.attachments?.length ? (
                      <ModalFieldGrid>
                        {selectedEvent.attachments.map((attachmentUrl, index) => {
                          const fileName = getAttachmentName(attachmentUrl);
                          const previewType = getAttachmentPreviewType(attachmentUrl);
                          const isMediaPreview =
                            previewType === "image" || previewType === "video";
                          return (
                            <div
                              key={`${attachmentUrl}-${index}`}
                              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                            >
                              <div className="h-28 overflow-hidden border-b border-slate-200 bg-slate-50">
                                {previewType === "image" ? (
                                  <a
                                    href={attachmentUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block h-full w-full"
                                  >
                                    <img
                                      src={attachmentUrl}
                                      alt={fileName}
                                      className="h-full w-full object-cover"
                                    />
                                  </a>
                                ) : previewType === "video" ? (
                                  <video
                                    src={attachmentUrl}
                                    controls
                                    preload="metadata"
                                    className="h-full w-full bg-slate-950 object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-slate-50">
                                    <div className="rounded-2xl bg-white p-4 text-slate-400 shadow-sm">
                                      <FileText className="h-8 w-8" />
                                    </div>
                                  </div>
                                )}
                              </div>
                              <a
                                href={attachmentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-bold text-slate-900" title={fileName}>
                                    {fileName}
                                  </p>
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                    {isMediaPreview
                                      ? translate("agendaPage.openAttachment")
                                      : previewType.toUpperCase()}
                                  </p>
                                </div>
                                <ExternalLink className="w-4 h-4 shrink-0 text-slate-400" />
                              </a>
                            </div>
                          );
                        })}
                      </ModalFieldGrid>
                    ) : (
                      <p className="mt-4 text-sm italic leading-7 text-slate-400">
                        {translate("agendaPage.noAttachments")}
                      </p>
                    )}
                  </ModalSection>
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
                    <p className="text-xs text-slate-500 font-medium">
                      {canSeeParticipants
                        ? translate("agendaPage.fullRegistryMessage")
                        : translate("agendaPage.privacyRestrictedMessage")}
                    </p>
                  </div>
                  <div className="space-y-2 text-left">
                    {!canSeeParticipants ? (
                      <div className="py-12 text-center text-slate-400">
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-slate-100">
                          <Users className="w-6 h-6 opacity-40" />
                        </div>
                        <p className="font-bold text-[10px] uppercase tracking-widest">
                          {translate("agendaPage.privacyRestricted")}
                        </p>
                        <p className="text-[9px] mt-1 italic font-medium">
                          {translate("agendaPage.registryLimited")}
                        </p>
                      </div>
                    ) : isLoadingRegistrations ? (
                      <div className="py-12 text-center">
                        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary" />
                        <p className="text-xs text-slate-400 mt-2 font-bold uppercase tracking-widest">
                          {translate("agendaPage.retrievingRegistry")}
                        </p>
                      </div>
                    ) : registrationsData?.registrations &&
                      registrationsData.registrations.length > 0 ? (
                      registrationsData.registrations.map((reg) => (
                        <div
                          key={reg.id}
                          className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100"
                        >
                          <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-[10px] font-black text-primary uppercase">
                            {(reg.user.first_name?.[0] || "") +
                              (reg.user.last_name?.[0] || "")}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {reg.user.first_name} {reg.user.last_name}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {translate("agendaPage.joinedOn", {
                                date: format(parseISO(reg.registered_at), "PPP", {
                                  locale: dateLocale,
                                }),
                              })}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center text-slate-400">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="font-medium text-sm">
                          {translate("agendaPage.noMembersRegistered")}
                        </p>
                        <p className="text-xs mt-1">
                          {translate("agendaPage.beFirstToJoin")}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </Modal>
      <CategoryManagerDialog
        isOpen={isCategoryModalOpen && isSuperuser}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={eventCategories}
        isLoading={isLoadingCategories}
        error={categoriesError}
        onRetry={() => { void refetchCategories(); }}
        canCreate={isSuperuser}
        canEdit={isSuperuser}
        canDelete={isSuperuser}
        supportsColor
        onCreate={handleCreateCategory}
        onUpdate={handleUpdateCategory}
        onDelete={handleDeleteCategory}
      />
      {/* Day List View Modal */}
      <Modal
        layout="drawer"
        maxWidth="max-w-lg"
        className="batch-three-modal"
        isOpen={dayViewModal.isOpen}
        onClose={() => setDayViewModal({ ...dayViewModal, isOpen: false })}
        title={
          dayViewModal.date
            ? format(dayViewModal.date, "MMMM d, yyyy", { locale: dateLocale })
            : translate("agendaPage.dailyEvents")
        }
      >
        <div className="space-y-3">
          {dayViewModal.events.map((event) => (
            <button
              type="button"
              key={event.id}
              onClick={() => {
                setDayViewModal({ ...dayViewModal, isOpen: false });
                handleEventClick(event);
              }}
              style={getEventCategoryStyle(event)}
              className="w-full min-w-0 p-3 rounded-2xl border flex items-center justify-between gap-3 group cursor-pointer transition-colors hover:brightness-95"
            >
              <div className="flex min-w-0 flex-1 flex-col break-words text-left [overflow-wrap:anywhere]">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">
                  {event.event_time} • {getEventCategoryLabel(event)}
                </span>
                <span className="font-bold text-sm text-slate-900 group-hover:text-primary-dark transition-colors">
                  {event.title}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary-dark transition-all" />
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
