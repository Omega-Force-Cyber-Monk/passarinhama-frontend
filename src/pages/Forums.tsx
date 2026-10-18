import { ModalFieldGrid, ModalFullWidth, ModalSubmitButton } from "../components/ui/ModalLayout";
import "./ArticleForumModals.css";
import React, { useEffect, useMemo, useState } from "react";
import {
  Paperclip,
  MessageSquare,
  Pin,
  MessageCircle,
  Eye,
  Clock,
  ArrowRight,
  Star,
  Plus,
  Trash2,
  ArrowLeft,
  Send,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  Edit2,
  FileText,
  Image as ImageIcon,
  Video,
  ExternalLink,
} from "lucide-react";
import TiptapEditor from "../components/ui/TiptapEditor";
import { motion, AnimatePresence } from "motion/react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useAppToast } from "../components/ui/AppToastProvider";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import {
  FilePreviewCard,
  FileUploadDropzone,
  SelectedFilesPreview,
} from "../components/ui/FileUploadPreview";
import { useI18n } from "../i18n";
import {
  Forum,
  ForumType,
  Topic,
  Post,
  UpdateForumTopicRequest,
} from "../types";
import { useSelector } from "react-redux";
import { RootState } from "../redux/store";
import { ROLE_SLUGS } from "../redux/features/auth/authTypes";
import {
  useCreateForumMutation,
  useCreateForumTopicMutation,
  useCreateTopicPostMutation,
  useDeleteForumMutation,
  useDeletePostMutation,
  useDeleteTopicMutation,
  useGetForumsQuery,
  useGetForumTopicsQuery,
  useGetTopicPostsQuery,
  usePinTopicMutation,
  useUpdateForumMutation,
  useUpdatePostMutation,
  useUpdateTopicMutation,
  useGetPinnedTopicsQuery,
} from "../redux/features/forum/forumApi";
import { useUploadFileMutation } from "../redux/features/articles/articlesApi";
import { usePermissions } from "../hooks/usePermissions";
import { getApiErrorDisplayMessage } from "../utils/apiErrorMessages";

// Forum view models
type ForumWithMeta = Forum & {
  author_name: string | null;
  posts: number;
  topics: number;
  color: string;
  featured?: boolean;
};

type ForumFormState = {
  id?: string;
  name: string;
  author_name: string;
  description: string;
  forum_type: ForumType;
  thumbnail: File | null;
  thumbnail_url: string | null;
};

const FORUM_COLORS = [
  "border-primary",
  "border-blue-400",
  "border-emerald-400",
  "border-purple-400",
  "border-amber-400",
  "border-rose-400",
  "border-gray-300",
  "border-slate-300",
];

const TOPICS_PAGE_SIZE = 20;
const POSTS_PAGE_SIZE = 20;

const DEFAULT_FORUM_TYPE: ForumType = "general";
type NewForumFormState = Omit<ForumFormState, "id" | "forum_type">;
const getDefaultNewForumFormData = (): NewForumFormState => ({
  name: "", author_name: "", description: "", thumbnail: null, thumbnail_url: null,
});
const getDefaultForumFormData = (): ForumFormState => ({
  ...getDefaultNewForumFormData(), forum_type: DEFAULT_FORUM_TYPE,
});

const ForumThumbnail = ({ src, frameClassName = "forum-thumbnail" }: { src?: string | null; frameClassName?: string }) => {
  const [failed, setFailed] = useState<string | null>(null);
  return <div className={frameClassName}>
    {src && failed !== src ? <img src={src} alt="" loading="lazy" onError={() => setFailed(src)} className="h-full w-full object-cover" /> : <MessageSquare aria-hidden="true" className="h-6 w-6 text-slate-400" />}
  </div>;
};

const SkeletonBar = ({ className }: { className: string }) => (
  <div className={`animate-pulse rounded-full bg-slate-100 ${className}`} />
);

const ForumsListSkeleton = () => (
  <div className="space-y-4">
    {Array.from({ length: 3 }).map((_, index) => (
      <div
        key={index}
        className="bg-white p-6 rounded-2xl border-l-[6px] border-slate-200 shadow-sm flex items-center justify-between gap-4 animate-pulse"
      >
        <div className="min-w-0 flex-1 space-y-3">
          <SkeletonBar className="h-6 w-1/3" />
          <SkeletonBar className="h-4 w-4/5" />
          <SkeletonBar className="h-3 w-2/5" />
          <div className="flex items-center gap-6 pt-2">
            <SkeletonBar className="h-3 w-24" />
            <SkeletonBar className="h-3 w-20" />
          </div>
        </div>
        <div className="h-12 w-12 rounded-full bg-slate-100" />
      </div>
    ))}
  </div>
);

const TopicsListSkeleton = () => (
  <div className="space-y-4">
    {Array.from({ length: 4 }).map((_, index) => (
      <div
        key={index}
        className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm animate-pulse"
      >
        <div className="space-y-3">
          <SkeletonBar className="h-6 w-3/5" />
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <SkeletonBar className="h-3 w-24" />
            <SkeletonBar className="h-3 w-20" />
            <SkeletonBar className="h-3 w-16" />
            <SkeletonBar className="h-3 w-16" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

const PostsListSkeleton = () => (
  <div className="space-y-6">
    {Array.from({ length: 3 }).map((_, index) => (
      <div
        key={index}
        className={`flex gap-4 animate-pulse ${index === 0 ? "" : "pt-6 border-t border-slate-100"}`}
      >
        <div className="shrink-0">
          <div className="forum-avatar bg-slate-100 rounded-2xl" />
        </div>
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <SkeletonBar className="h-4 w-32" />
            <SkeletonBar className="h-3 w-20" />
          </div>
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-3">
            <SkeletonBar className="h-4 w-full" />
            <SkeletonBar className="h-4 w-5/6" />
            <SkeletonBar className="h-4 w-3/5" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

const LatestActivitySkeleton = () => (
  <div className="space-y-6">
    {Array.from({ length: 4 }).map((_, index) => (
      <div key={index} className="space-y-3 animate-pulse">
        <div className="flex min-w-0 flex-wrap justify-between items-start gap-2">
          <SkeletonBar className="h-5 w-24 rounded" />
          <SkeletonBar className="h-3 w-20" />
        </div>
        <SkeletonBar className="h-4 w-4/5" />
        <div className="flex items-center gap-3">
          <SkeletonBar className="h-3 w-16" />
          <SkeletonBar className="h-3 w-14" />
        </div>
      </div>
    ))}
  </div>
);

const PinnedDiscussionsSkeleton = () => (
  <div className="space-y-4">
    {Array.from({ length: 3 }).map((_, index) => (
      <div key={index} className="space-y-2 animate-pulse">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonBar className="h-4 w-4/5" />
            <SkeletonBar className="h-3 w-2/5" />
          </div>
          <SkeletonBar className="h-7 w-16 rounded-full" />
        </div>
      </div>
    ))}
  </div>
);

const ForumsPageSkeleton = () => (
  <div className="forums-page">
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="space-y-3">
        <SkeletonBar className="h-10 w-72" />
        <div className="flex items-center gap-2">
          <SkeletonBar className="h-3 w-16" />
          <SkeletonBar className="h-3 w-3 rounded-full" />
          <SkeletonBar className="h-3 w-20" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SkeletonBar className="h-12 w-36 rounded-xl" />
        <SkeletonBar className="h-12 w-36 rounded-xl" />
        <SkeletonBar className="h-12 w-32 rounded-xl" />
      </div>
    </header>

    <div className="forums-layout">
      <div className="forums-main">
        <ForumsListSkeleton />
      </div>

      <div className="space-y-6">
        <div className="forum-side-panel bg-slate-900 text-white rounded-2xl shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16" />
          <div className="relative space-y-4">
            <SkeletonBar className="h-6 w-44 bg-slate-700" />
            <PinnedDiscussionsSkeleton />
          </div>
        </div>

        <div className="forum-side-panel bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="space-y-6">
            <SkeletonBar className="h-6 w-36" />
            <LatestActivitySkeleton />
            <SkeletonBar className="h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  </div>
);

const formatTopicActivity = (value: string, localeCode: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(localeCode, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const stripHtml = (value: string | null | undefined) =>
  (value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

const normalizeRichText = (value: string | null | undefined) => {
  const normalized = value?.trim() || "";
  return stripHtml(normalized) ? normalized : undefined;
};

const trimOrUndefined = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const hasRichTextContent = (value: string | null | undefined) =>
  Boolean(stripHtml(value));

const areStringArraysEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const mergeUniqueFiles = (currentFiles: File[], nextFiles: File[]) => {
  const existingKeys = new Set(
    currentFiles.map((file) => `${file.name}-${file.size}-${file.lastModified}`),
  );

  const uniqueNextFiles = nextFiles.filter((file) => {
    const key = `${file.name}-${file.size}-${file.lastModified}`;
    return !existingKeys.has(key);
  });

  return [...currentFiles, ...uniqueNextFiles];
};

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "svg",
  "bmp",
  "avif",
]);

const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "webm",
  "ogg",
  "mov",
  "m4v",
]);

const getAttachmentInfoFromFilename = (filename: string) => {
  const extension = filename.includes(".")
    ? filename.split(".").pop()?.toLowerCase() || ""
    : "";

  if (IMAGE_EXTENSIONS.has(extension)) {
    return { kind: "image" as const, filename, extension };
  }

  if (VIDEO_EXTENSIONS.has(extension)) {
    return { kind: "video" as const, filename, extension };
  }

  return { kind: "file" as const, filename, extension };
};

const getAttachmentInfo = (attachmentUrl: string) => {
  let pathname = attachmentUrl;

  try {
    pathname = new URL(attachmentUrl).pathname;
  } catch {
    pathname = attachmentUrl.split("?")[0];
  }

  const filename = decodeURIComponent(pathname.split("/").pop() || "attachment");

  return getAttachmentInfoFromFilename(filename);
};

const AttachmentGallery = ({
  attachments,
  translate,
}: {
  attachments: string[];
  translate: (key: string, params?: Record<string, string | number>) => string;
}) => (
  <div className="forum-attachments">
    {attachments.map((attachment, attachmentIndex) => {
      const info = getAttachmentInfo(attachment);

      if (info.kind === "image") {
        return (
          <a
            key={`${attachment}-${attachmentIndex}`}
            href={attachment}
            target="_blank"
            rel="noreferrer"
            className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:shadow-md"
          >
            <ForumThumbnail src={attachment} frameClassName="forum-attachment-image" />
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2 text-slate-600">
                <ImageIcon className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate text-xs font-bold">{info.filename}</span>
              </div>
              <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />
            </div>
          </a>
        );
      }

      if (info.kind === "video") {
        return (
          <div
            key={`${attachment}-${attachmentIndex}`}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
          >
            <video
              controls
              preload="metadata"
              className="h-48 w-full bg-slate-950"
            >
              <source src={attachment} />
            </video>
            <a
              href={attachment}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 hover:bg-slate-50"
            >
              <div className="flex min-w-0 items-center gap-2 text-slate-600">
                <Video className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate text-xs font-bold">{info.filename}</span>
              </div>
              <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />
            </a>
          </div>
        );
      }

      return (
        <a
          key={`${attachment}-${attachmentIndex}`}
          href={attachment}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 transition-colors hover:bg-slate-50"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-3 text-slate-600">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-700">
                {info.filename}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {info.extension === "pdf"
                  ? "PDF"
                  : translate("forumsPage.attachment", {
                      count: attachmentIndex + 1,
                    })}
              </p>
            </div>
          </div>
          <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />
        </a>
      );
    })}
  </div>
);

const PendingAttachmentGallery = ({
  files,
  onRemove,
}: {
  files: File[];
  onRemove: (index: number) => void;
}) => (
  <div className="forum-attachments">
    {files.map((file, index) => (
      <FilePreviewCard
        key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
        file={file}
        onRemove={() => onRemove(index)}
      />
    ))}
  </div>
);

const EditableAttachmentGallery = ({
  attachments,
  onRemove,
  translate,
}: {
  attachments: string[];
  onRemove: (url: string) => void;
  translate: (key: string, params?: Record<string, string | number>) => string;
}) => (
  <div className="forum-attachments">
    {attachments.map((attachment, attachmentIndex) => {
      const info = getAttachmentInfo(attachment);

      return (
        <FilePreviewCard
          key={`${attachment}-${attachmentIndex}`}
          url={attachment}
          href={attachment}
          name={
            info.filename ||
            translate("forumsPage.existingFile", {
              count: attachmentIndex + 1,
            })
          }
          subtitle={translate("forumsPage.openFile")}
          onRemove={() => onRemove(attachment)}
        />
      );
    })}
  </div>
);

type ListView = "forums" | "topics" | "posts";

type DeleteTarget =
  | { kind: "forum"; id: string }
  | { kind: "topic"; id: string; forumId?: string }
  | { kind: "post"; id: string; topicId: string; forumId?: string };

type EditTopicFormData = {
  id: string;
  forumId: string;
  title: string;
  content: string;
  attachments: string[];
  deleteFiles: string[];
};

export default function Forums() {
  const toast = useAppToast();
  const navigate = useNavigate();
  const { localeCode, translate } = useI18n();
  const { forumId, topicId } = useParams<{
    forumId?: string;
    topicId?: string;
  }>();
  const { data: forumData, isLoading: isForumsLoading, isError: isForumsError } = useGetForumsQuery({
    pageSize: 100,
  });
  const {
    data: pinnedTopics = [],
    isLoading: isPinnedTopicsLoading,
    isError: isPinnedTopicsError,
    refetch: refetchPinnedTopics,
  } = useGetPinnedTopicsQuery();
  const [createForum, { isLoading: isCreatingForum }] =
    useCreateForumMutation();
  const [deleteForum, { isLoading: isDeletingForum }] =
    useDeleteForumMutation();
  const [updateForum, { isLoading: isUpdatingForum }] =
    useUpdateForumMutation();
  const [createForumTopic, { isLoading: isCreatingTopic }] =
    useCreateForumTopicMutation();
  const [deleteTopic, { isLoading: isDeletingTopic }] =
    useDeleteTopicMutation();
  const [updateTopic, { isLoading: isUpdatingTopic }] =
    useUpdateTopicMutation();
  const [createTopicPost, { isLoading: isCreatingPost }] =
    useCreateTopicPostMutation();
  const [deletePost, { isLoading: isDeletingPost }] = useDeletePostMutation();
  const [updatePost, { isLoading: isUpdatingPost }] = useUpdatePostMutation();
  const [pinTopic, { isLoading: isPinningTopic }] = usePinTopicMutation();
  const [uploadFile] = useUploadFileMutation();

  const handleImageUpload = async (file: File): Promise<string> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await uploadFile(formData).unwrap();
      return response.url;
    } catch (error) {
      toast.error(getApiErrorDisplayMessage(error, translate, "apiErrors.default"));
      throw error;
    }
  };

  const { user } = useSelector((state: RootState) => state.auth);
  const { hasPermission } = usePermissions();
  const isSuperuser = Boolean(user?.is_superuser);
  const currentUserId = user?.id || "";
  const view: ListView = topicId ? "posts" : forumId ? "topics" : "forums";
  const selectedForumId = forumId || null;
  const selectedTopicId = topicId || null;
  const [topicPage, setTopicPage] = useState(1);
  const [postPage, setPostPage] = useState(1);

  const [localTopics, setLocalTopics] = useState<Topic[]>([]);
  const [hiddenTopicIds, setHiddenTopicIds] = useState<string[]>([]);
  const [localPosts, setLocalPosts] = useState<Post[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewForumModalOpen, setIsNewForumModalOpen] = useState(false);
  const [isEditForumModalOpen, setIsEditForumModalOpen] = useState(false);
  const [isEditTopicModalOpen, setIsEditTopicModalOpen] = useState(false);
  const [isEditPostModalOpen, setIsEditPostModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    forumId: "",
  });
  const [topicFiles, setTopicFiles] = useState<File[]>([]);
  const [newForumData, setNewForumData] = useState<NewForumFormState>(
    getDefaultNewForumFormData(),
  );
  const [editForumData, setEditForumData] = useState<ForumFormState>({
    ...getDefaultForumFormData(),
    id: "",
  });
  const [editTopicData, setEditTopicData] = useState<EditTopicFormData>({
    id: "",
    forumId: "",
    title: "",
    content: "",
    attachments: [],
    deleteFiles: [],
  });
  const [initialEditTopicData, setInitialEditTopicData] =
    useState<EditTopicFormData | null>(null);
  const [editTopicFiles, setEditTopicFiles] = useState<File[]>([]);

  const [replyText, setReplyText] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [editPostData, setEditPostData] = useState({
    id: "",
    topicId: "",
    forumId: "",
    content: "",
    attachments: [] as string[],
  });
  const [editPostFiles, setEditPostFiles] = useState<File[]>([]);
  const [pinningTopicId, setPinningTopicId] = useState<string | null>(null);

  const showRequiredFieldError = (fieldLabel: string) => {
    toast.error(
      translate("common.requiredField", {
        field: fieldLabel,
      }),
    );
  };

  const forums = useMemo<ForumWithMeta[]>(() => {
    const apiForums = (forumData?.results || []).map((forum, index) => ({
      id: forum.id,
      name: forum.name,
      forum_type: forum.forum_type,
      author_name: forum.author_name,
      description: forum.description || translate("forumsPage.defaultForumDescription"),
      thumbnail_url: forum.thumbnail_url,
      posts: forum.post_count,
      topics: forum.topic_count,
      color: FORUM_COLORS[index % FORUM_COLORS.length],
      featured: index === 0,
      readRoles: [ROLE_SLUGS.MEMBER],
      writeRoles: forum.can_post ? [ROLE_SLUGS.MEMBER] : [],
    }));

    return apiForums;
  }, [forumData, translate]);

  const activeForumId = selectedForumId || forums[0]?.id || "";
  const {
    currentData: forumTopicsData,
    isLoading: isTopicsLoading,
    isFetching: isTopicsFetching,
    isError: isTopicsError,
  } = useGetForumTopicsQuery(
    {
      forumId: activeForumId,
      page: topicPage,
      pageSize: TOPICS_PAGE_SIZE,
    },
    {
    skip: !activeForumId,
    },
  );
  const {
    currentData: topicPostsData,
    isLoading: isPostsLoading,
    isFetching: isPostsFetching,
    isError: isPostsError,
  } = useGetTopicPostsQuery(
    {
      topicId: selectedTopicId || "",
      page: postPage,
      pageSize: POSTS_PAGE_SIZE,
    },
    {
      skip: !selectedTopicId,
    },
  );

  useEffect(() => {
    if (!forums.length) {
      return;
    }

    if (!forums.some((forum) => forum.id === formData.forumId)) {
      setFormData((prev) => ({
        ...prev,
        forumId: selectedForumId || forums[0].id,
      }));
    }

  }, [forums, formData.forumId, selectedForumId]);

  useEffect(() => {
    setTopicPage(1);
  }, [selectedForumId]);

  useEffect(() => {
    setPostPage(1);
  }, [selectedTopicId]);

  const topics = useMemo<Topic[]>(() => {
    const scopedLocalTopics = localTopics.filter(
      (topic) => topic.forumId === activeForumId,
    );
    const localTopicIds = new Set(scopedLocalTopics.map((topic) => topic.id));
    const apiTopics = (forumTopicsData?.results || [])
      .map((topic) => {
        const authorName =
          `${topic.author.first_name} ${topic.author.last_name}`.trim();

        return {
          id: topic.id,
          forumId: activeForumId,
          title: topic.title,
          content: topic.content,
          authorId: authorName || topic.author.id,
          authorUserId: topic.author.id,
          createdAt: topic.created_at,
          replyCount: topic.reply_count,
          viewCount: topic.view_count,
          lastActivity: formatTopicActivity(topic.last_activity_at, localeCode),
          isPinned: topic.is_pinned,
          status: "approved" as const,
          attachments: topic.attachment,
        };
      })
      .filter((topic) => !localTopicIds.has(topic.id));

    return [...scopedLocalTopics, ...apiTopics].filter(
      (topic) => !hiddenTopicIds.includes(topic.id),
    );
  }, [activeForumId, forumTopicsData, hiddenTopicIds, localTopics, localeCode]);

  // Derived data
  const filteredTopics = useMemo(() => {
    if (view === "forums") return topics.slice(0, 5);
    return topics;
  }, [topics, view]);

  const totalTopicPages = forumTopicsData
    ? Math.max(
        1,
        forumTopicsData.total_pages ||
          Math.ceil(
            forumTopicsData.total /
              (forumTopicsData.page_size || TOPICS_PAGE_SIZE),
          ),
      )
    : 1;

  const totalPostPages = topicPostsData
    ? Math.max(
        1,
        topicPostsData.total_pages ||
          Math.ceil(
            topicPostsData.total /
              (topicPostsData.page_size || POSTS_PAGE_SIZE),
          ),
      )
    : 1;

  const selectedForum = useMemo(
    () => forums.find((f) => f.id === selectedForumId),
    [forums, selectedForumId],
  );

  const selectedTopic = useMemo(
    () => topics.find((t) => t.id === selectedTopicId),
    [topics, selectedTopicId],
  );

  const topicPosts = useMemo<Post[]>(() => {
    const scopedLocalPosts = localPosts.filter(
      (post) => post.topicId === selectedTopicId,
    );
    const localPostIds = new Set(scopedLocalPosts.map((post) => post.id));
    const apiPosts = (topicPostsData?.results || [])
      .map((post) => {
        const authorName =
          `${post.author.first_name} ${post.author.last_name}`.trim();

        return {
          id: post.id,
          topicId: selectedTopicId || "",
          authorId: authorName || post.author.id,
          authorUserId: post.author.id,
          content: post.content,
          createdAt: post.created_at,
          status: post.moderation_status,
          attachments: post.attachment,
        };
      })
      .filter((post) => !localPostIds.has(post.id));

    return [...apiPosts, ...scopedLocalPosts];
  }, [localPosts, selectedTopicId, topicPostsData]);

  // Handlers
  const handleNavigateToForum = (id: string) => {
    navigate(`/forums/${id}`);
    window.scrollTo(0, 0);
  };

  const handleNavigateToTopic = (id: string) => {
    const topic = topics.find((t) => t.id === id);
    if (topic) {
      navigate(`/forums/${topic.forumId}/topics/${id}`);
      window.scrollTo(0, 0);
    }
  };

  const handleBack = () => {
    if (view === "posts") {
      navigate(selectedForumId ? `/forums/${selectedForumId}` : "/forums");
    } else if (view === "topics") {
      navigate("/forums");
    }
    window.scrollTo(0, 0);
  };

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateTopic) return;

    if (!formData.title.trim()) {
      showRequiredFieldError(translate("forumsPage.discussionTitle"));
      return;
    }

    if (!formData.forumId) {
      showRequiredFieldError(translate("forumsPage.forum"));
      return;
    }

    if (!hasRichTextContent(formData.content)) {
      showRequiredFieldError(translate("forumsPage.content"));
      return;
    }

    try {
      await createForumTopic({
        forum_id: formData.forumId,
        title: formData.title.trim(),
        content: normalizeRichText(formData.content) || "",
        files: topicFiles.length ? topicFiles : undefined,
      }).unwrap();

      setFormData({
        title: "",
        content: "",
        forumId: selectedForumId || forums[0]?.id || "",
      });
      setTopicFiles([]);
      setIsModalOpen(false);
      toast.success(translate("forumsPage.success"));
    } catch (error) {
      toast.error(getApiErrorDisplayMessage(error, translate, "apiErrors.default"));
    }
  };

  const handleAddForum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateForum) return;

    if (!newForumData.name.trim()) {
      showRequiredFieldError(translate("forumsPage.forumName"));
      return;
    }

    try {
      await createForum({
        name: newForumData.name.trim(),
        author_name: trimOrUndefined(newForumData.author_name),
        description: normalizeRichText(newForumData.description),
        forum_type: DEFAULT_FORUM_TYPE,
        thumbnail: newForumData.thumbnail,
      }).unwrap();

      setNewForumData(getDefaultNewForumFormData());
      setIsNewForumModalOpen(false);
      toast.success(translate("forumsPage.success"));
    } catch (error) {
      toast.error(getApiErrorDisplayMessage(error, translate, "apiErrors.default"));
    }
  };

  const handleOpenEditForum = (
    event: React.MouseEvent<HTMLButtonElement>,
    forum: ForumWithMeta,
  ) => {
    event.stopPropagation();
    if (!canEditForum) return;
    setEditForumData({
      id: forum.id,
      name: forum.name,
      author_name: forum.author_name || "",
      description: forum.description || "",
      forum_type: forum.forum_type || "general",
      thumbnail: null,
      thumbnail_url: forum.thumbnail_url || null,
    });
    setIsEditForumModalOpen(true);
  };

  const handleUpdateForum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditForum) return;

    if (!editForumData.name.trim()) {
      showRequiredFieldError(translate("forumsPage.forumName"));
      return;
    }

    try {
      await updateForum({
        forum_id: editForumData.id,
        name: trimOrUndefined(editForumData.name),
        author_name: trimOrUndefined(editForumData.author_name),
        description: normalizeRichText(editForumData.description),
        forum_type: editForumData.forum_type,
        thumbnail: editForumData.thumbnail,
      }).unwrap();

      setIsEditForumModalOpen(false);
      setEditForumData(getDefaultForumFormData());
      toast.success(translate("forumsPage.success"));
    } catch (error) {
      toast.error(getApiErrorDisplayMessage(error, translate, "apiErrors.default"));
    }
  };

  const handleOpenEditTopic = (
    event: React.MouseEvent<HTMLButtonElement>,
    topic: Topic,
  ) => {
    event.stopPropagation();
    if (!canEditTopic(topic)) return;
    const nextEditTopicData = {
      id: topic.id,
      forumId: topic.forumId,
      title: topic.title,
      content: topic.content || "",
      attachments: topic.attachments || [],
      deleteFiles: [],
    };

    setEditTopicData(nextEditTopicData);
    setInitialEditTopicData(nextEditTopicData);
    setEditTopicFiles([]);

    setIsEditTopicModalOpen(true);
  };

  const handleUpdateTopic = async (e: React.FormEvent) => {
    e.preventDefault();

    const topicToEdit = topics.find((topic) => topic.id === editTopicData.id);
    if (!topicToEdit || !canEditTopic(topicToEdit)) return;

    if (!initialEditTopicData) {
      return;
    }

    const nextTitle = editTopicData.title.trim();
    const nextContent = normalizeRichText(editTopicData.content) || "";

    if (!nextTitle) {
      showRequiredFieldError(translate("forumsPage.discussionTitle"));
      return;
    }

    if (!nextContent) {
      showRequiredFieldError(translate("forumsPage.content"));
      return;
    }

    const payload: UpdateForumTopicRequest = {
      topic_id: editTopicData.id,
      forum_id: editTopicData.forumId,
      title: nextTitle,
      content: nextContent,
    };

    if (editTopicFiles.length > 0) {
      payload.files = editTopicFiles;
    }

    if (editTopicData.deleteFiles.length > 0) {
      payload.delete_files = editTopicData.deleteFiles;
    }

    if (
      payload.title === initialEditTopicData.title.trim() &&
      payload.content ===
        (normalizeRichText(initialEditTopicData.content) || "") &&
      payload.files === undefined &&
      payload.delete_files === undefined
    ) {
      setEditTopicFiles([]);
      setInitialEditTopicData(null);
      setIsEditTopicModalOpen(false);
      return;
    }

    try {
      const updatedTopic = await updateTopic(payload).unwrap();

      setLocalTopics((prev) =>
        prev.map((topic) =>
          topic.id === editTopicData.id
            ? {
                ...topic,
                title: updatedTopic.title,
                content: updatedTopic.content,
                attachments: updatedTopic.attachment || [],
                replyCount: updatedTopic.reply_count,
                viewCount: updatedTopic.view_count,
                isPinned: updatedTopic.is_pinned,
                createdAt: updatedTopic.created_at,
                lastActivity: formatTopicActivity(
                  updatedTopic.last_activity_at,
                  localeCode,
                ),
              }
            : topic,
        ),
      );
      setEditTopicData((prev) => ({
        ...prev,
        title: updatedTopic.title,
        content: updatedTopic.content,
        attachments: updatedTopic.attachment || [],
        deleteFiles: [],
      }));
      setEditTopicFiles([]);
      setInitialEditTopicData(null);
      setIsEditTopicModalOpen(false);
      toast.success(translate("forumsPage.success"));
    } catch (error) {
      toast.error(getApiErrorDisplayMessage(error, translate, "apiErrors.default"));
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPostMessage || !selectedTopicId) return;

    if (!hasRichTextContent(replyText)) {
      showRequiredFieldError(translate("forumsPage.content"));
      return;
    }

    try {
      await createTopicPost({
        topic_id: selectedTopicId,
        forum_id: selectedForumId || undefined,
        content: normalizeRichText(replyText) || "",
        files: replyFiles.length ? replyFiles : undefined,
      }).unwrap();

      setReplyText("");
      setReplyFiles([]);
      toast.success(translate("forumsPage.success"));
    } catch (error) {
      toast.error(getApiErrorDisplayMessage(error, translate, "apiErrors.default"));
    }
  };

  const handleOpenEditPost = (
    event: React.MouseEvent<HTMLButtonElement>,
    post: Post,
  ) => {
    event.stopPropagation();
    if (!canManagePost(post, "edit")) return;
    setEditPostData({
      id: post.id,
      topicId: post.topicId,
      forumId: selectedForumId || "",
      content: post.content,
      attachments: post.attachments || [],
    });
    setEditPostFiles([]);
    setIsEditPostModalOpen(true);
  };

  const handleEditPostFilesChange = (nextFiles: File[]) => {
    if (!nextFiles.length) {
      return;
    }

    setEditPostFiles((prev) => mergeUniqueFiles(prev, nextFiles));
  };

  const handleRemoveEditPostFile = (indexToRemove: number) => {
    setEditPostFiles((prev) =>
      prev.filter((_, index) => index !== indexToRemove),
    );
  };

  const handleUpdatePost = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!normalizeRichText(editPostData.content)) {
      showRequiredFieldError(translate("forumsPage.content"));
      return;
    }

    const postToEdit = topicPosts.find((post) => post.id === editPostData.id);
    if (!postToEdit || !canManagePost(postToEdit, "edit")) return;

    try {
      await updatePost({
        post_id: editPostData.id,
        topic_id: editPostData.topicId,
        forum_id: editPostData.forumId || undefined,
        content: editPostData.content,
        files: editPostFiles,
      }).unwrap();

      setLocalPosts((prev) =>
        prev.map((post) =>
          post.id === editPostData.id
            ? {
                ...post,
                content: editPostData.content,
              }
            : post,
        ),
      );
      setEditPostFiles([]);
      setIsEditPostModalOpen(false);
      toast.success(translate("forumsPage.success"));
    } catch (error) {
      toast.error(getApiErrorDisplayMessage(error, translate, "apiErrors.default"));
    }
  };

  const handleReplyFilesChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const nextFiles = Array.from(event.target.files || []);

    if (!nextFiles.length) {
      return;
    }

    setReplyFiles((prev) => {
      const existingKeys = new Set(
        prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`),
      );
      const uniqueNextFiles = nextFiles.filter((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        return !existingKeys.has(key);
      });

      return [...prev, ...uniqueNextFiles];
    });

    event.target.value = "";
  };

  const handleRemoveReplyFile = (indexToRemove: number) => {
    setReplyFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleTopicFilesChange = (nextFiles: File[]) => {
    if (!nextFiles.length) {
      return;
    }

    setTopicFiles((prev) => mergeUniqueFiles(prev, nextFiles));
  };

  const handleRemoveTopicFile = (indexToRemove: number) => {
    setTopicFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleEditTopicFilesChange = (nextFiles: File[]) => {
    if (!nextFiles.length) {
      return;
    }

    setEditTopicFiles((prev) => mergeUniqueFiles(prev, nextFiles));
  };

  const handleRemoveEditTopicFile = (index: number) => {
    setEditTopicFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingAttachment = (urlToRemove: string) => {
    setEditTopicData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((url) => url !== urlToRemove),
      deleteFiles: prev.deleteFiles.includes(urlToRemove)
        ? prev.deleteFiles
        : [...prev.deleteFiles, urlToRemove],
    }));
  };

  const handleTogglePin = async (
    event: React.MouseEvent<HTMLButtonElement>,
    topic: Topic,
  ) => {
    event.stopPropagation();
    if (!canPinTopic) return;
    setPinningTopicId(topic.id);

    try {
      await pinTopic({
        topic_id: topic.id,
        forum_id: topic.forumId,
        pinned: !topic.isPinned,
      }).unwrap();

      setLocalTopics((prev) => {
        const hasLocalTopic = prev.some((item) => item.id === topic.id);

        if (hasLocalTopic) {
          return prev.map((item) =>
            item.id === topic.id
              ? { ...item, isPinned: !topic.isPinned }
              : item,
          );
        }

        return [{ ...topic, isPinned: !topic.isPinned }, ...prev];
      });
    } catch (error) {
      toast.error(getApiErrorDisplayMessage(error, translate, "apiErrors.default"));
    } finally {
      setPinningTopicId(null);
    }
  };

  const isDeletingItem = isDeletingForum || isDeletingTopic || isDeletingPost;

  const confirmDeleteForum = (
    event: React.MouseEvent<HTMLButtonElement>,
    forumId: string,
  ) => {
    event.stopPropagation();
    if (!canDeleteForum) return;
    setDeleteTarget({ kind: "forum", id: forumId });
    setIsConfirmOpen(true);
  };

  const confirmDeleteTopic = (
    event: React.MouseEvent<HTMLButtonElement>,
    topicId: string,
    forumId?: string,
  ) => {
    event.stopPropagation();
    const topic = topics.find((item) => item.id === topicId);
    if (!topic || !canDeleteTopic(topic)) return;
    setDeleteTarget({ kind: "topic", id: topicId, forumId });
    setIsConfirmOpen(true);
  };

  const confirmDeletePost = (
    event: React.MouseEvent<HTMLButtonElement>,
    postId: string,
    topicId: string,
    forumId?: string,
  ) => {
    event.stopPropagation();
    const post = topicPosts.find((item) => item.id === postId);
    if (!post || !canManagePost(post, "delete")) return;
    setDeleteTarget({ kind: "post", id: postId, topicId, forumId });
    setIsConfirmOpen(true);
  };

  const handleDeleteItem = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.kind === "forum") {
        await deleteForum(deleteTarget.id).unwrap();

        if (selectedForumId === deleteTarget.id) {
          navigate("/forums");
        }
      }

      if (deleteTarget.kind === "topic") {
        await deleteTopic({
          topic_id: deleteTarget.id,
          forum_id: deleteTarget.forumId,
        }).unwrap();
        await refetchPinnedTopics();

        setLocalTopics((prev) =>
          prev.filter((topic) => topic.id !== deleteTarget.id),
        );
        setHiddenTopicIds((prev) =>
          prev.includes(deleteTarget.id) ? prev : [...prev, deleteTarget.id],
        );
        setLocalPosts((prev) =>
          prev.filter((post) => post.topicId !== deleteTarget.id),
        );

        if (selectedTopicId === deleteTarget.id) {
          navigate(selectedForumId ? `/forums/${selectedForumId}` : "/forums");
        }
      }

      if (deleteTarget.kind === "post") {
        await deletePost({
          post_id: deleteTarget.id,
          topic_id: deleteTarget.topicId,
          forum_id: deleteTarget.forumId,
        }).unwrap();

        setLocalPosts((prev) =>
          prev.filter((post) => post.id !== deleteTarget.id),
        );
      }

      setDeleteTarget(null);
      setIsConfirmOpen(false);
      toast.success(translate("forumsPage.success"));
    } catch (error) {
      toast.error(getApiErrorDisplayMessage(error, translate, "apiErrors.default"));
    }
  };

  const canViewForum = hasPermission("forum", "view");
  const canCreateForum = hasPermission("forum", "create");
  const canCreateTopic = hasPermission("forum", "create");
  const canPostMessage = canViewForum;
  const canEditForum = hasPermission("forum", "edit");
  const canDeleteForum = hasPermission("forum", "delete");
  const canPinTopic = isSuperuser;
  const canEditTopic = (topic: Topic) =>
    isSuperuser || Boolean(topic.authorUserId && topic.authorUserId === currentUserId);
  const canDeleteTopic = (topic: Topic) => canEditTopic(topic);
  const canManagePost = (post: Post, _action: "edit" | "delete" = "edit") =>
    isSuperuser ||
    Boolean(post.authorUserId && post.authorUserId === currentUserId);
  const showInitialForumsPageSkeleton =
    view === "forums" && isForumsLoading && !forums.length;

  if (!canViewForum) {
    return <Navigate to="/" replace state={{ accessRestricted: true }} />;
  }

  if (showInitialForumsPageSkeleton) {
    return <ForumsPageSkeleton />;
  }

  return (
    <div className="forums-page">
      <header className="forums-header">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {view !== "forums" ? <button type="button" onClick={handleBack} aria-label={translate("forumUi.back")} className="forum-icon-button shrink-0"><ArrowLeft className="h-5 w-5" /></button> : null}
          <div className="min-w-0 flex-1">
            <h2 className="content-page-title">
              {view === "forums" ? translate("forumsPage.discussionForums") : view === "topics" ? selectedForum?.name : selectedTopic?.title}
            </h2>
            <nav aria-label={translate("forumUi.breadcrumbs")} className="forum-breadcrumbs">
              <button type="button" onClick={() => navigate("/forums")} aria-current={view === "forums" ? "page" : undefined}>{translate("forumsPage.forums")}</button>
              {selectedForum ? <><ChevronRight aria-hidden="true" className="h-3 w-3 shrink-0" /><button type="button" onClick={() => navigate(selectedForumId ? '/forums/' + selectedForumId : '/forums')} aria-current={view === "topics" ? "page" : undefined}>{selectedForum.name}</button></> : null}
              {selectedTopic ? <><ChevronRight aria-hidden="true" className="h-3 w-3 shrink-0" /><span aria-current="page">{translate("forumsPage.discussion")}</span></> : null}
            </nav>
          </div>
        </div>
        <div className="content-page-actions forums-header-actions">
          {view === "forums" && canCreateForum ? <button type="button" onClick={() => setIsNewForumModalOpen(true)} className="content-page-button content-page-button-secondary"><MessageSquare className="h-4 w-4 shrink-0" />{translate("forumsPage.newForum")}</button> : null}
          {view !== "posts" && canCreateTopic ? <button type="button" onClick={() => {
            setFormData((previous) => ({ ...previous, forumId: selectedForumId || forums[0]?.id || "" }));
            setIsModalOpen(true);
          }} className="content-page-button content-page-button-primary"><Plus className="h-4 w-4 shrink-0" />{translate("forumsPage.newTopic")}</button> : null}
        </div>
      </header>

      <div className="forums-layout">
        <div className="forums-main">
          {view === "posts" && !selectedTopic ? (
            isTopicsLoading || isTopicsFetching ? <PostsListSkeleton /> : <p role="status" className="forum-empty-state">{translate(isTopicsError ? "forumUi.loadError" : "forumUi.topicUnavailable")}</p>
          ) : null}
          <AnimatePresence mode="wait">
            {/* VIEW: FORUMS LIST */}
            {view === "forums" && canViewForum && (
              <motion.div
                key="forums-list"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                {isForumsLoading && !forums.length ? (
                  <ForumsListSkeleton />
                ) : isForumsError ? (<p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{translate("forumUi.loadError")}</p>) : !forums.length ? (<p className="forum-empty-state">{translate("forumUi.noForums")}</p>) : (
                  forums.map((forum) => (
                    <motion.div
                      key={forum.id}
                      onClick={() => handleNavigateToForum(forum.id)}
                      role="link"
                      tabIndex={0}
                      onKeyDown={(event) => { if (event.key === "Enter" && event.target === event.currentTarget) { event.preventDefault(); handleNavigateToForum(forum.id); } }}
                      className={`forum-list-card group border-l-[6px] ${forum.color}`}
                    >
                      <div className="forum-summary">
                        <ForumThumbnail src={forum.thumbnail_url} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="forum-list-title font-bold group-hover:text-primary-dark transition-colors text-slate-900">
                              {forum.name}
                            </h3>
                          </div>
                          <div
                            className="forum-summary-description mt-1 text-sm text-slate-500 prose prose-sm prose-slate max-w-none prose-p:my-0 prose-p:text-slate-500 prose-strong:text-slate-700 prose-a:text-primary prose-ul:my-1 prose-ol:my-1 line-clamp-3"
                            dangerouslySetInnerHTML={{
                              __html:
                                forum.description ||
                                `<p>${translate("forumsPage.defaultForumDescription")}</p>`,
                            }}
                          />
                          {forum.author_name && (
                            <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-2">
                              {translate("forumsPage.responsible", {
                                name: forum.author_name,
                              })}
                            </p>
                          )}
                          <div className="forum-metadata mt-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            <span className="flex items-center gap-1.5">
                              <MessageCircle className="w-3.5 h-3.5" />{" "}
                              {forum.topics} {translate("forumsPage.topics")}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <MessageSquare className="w-3.5 h-3.5" />{" "}
                              {forum.posts} {translate("forumsPage.posts")}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="forum-row-actions">
                        {(canEditForum || canDeleteForum) && (
                          <div className="flex items-center gap-2">
                            {canEditForum && (
                              <button
                                type="button"
                                onClick={(event) =>
                                  handleOpenEditForum(event, forum)
                                }
                                aria-label={translate("forumsPage.editForum")}
                                className="p-2 rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            {canDeleteForum && (
                              <button
                                type="button"
                                onClick={(event) =>
                                  confirmDeleteForum(event, forum.id)
                                }
                                aria-label={translate("forumsPage.deleteForum")}
                                className="p-2 rounded-full bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                        <div className="p-2 rounded-full bg-slate-50 text-slate-400 group-hover:bg-primary group-hover:text-slate-900 transition-colors">
                          <ArrowRight className="w-6 h-6" />
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </motion.div>
            )}

            {/* VIEW: TOPICS LIST */}
            {view === "topics" && canViewForum && (
              <motion.div
                key="topics-list"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                {(isTopicsLoading || isTopicsFetching) &&
                !filteredTopics.length ? (
                  <TopicsListSkeleton />
                ) : isTopicsError ? (<p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{translate("forumUi.loadError")}</p>) : filteredTopics.length > 0 ? (
                  <>
                    {filteredTopics.map((topic) => (
                      <motion.div
                        key={topic.id}
                        onClick={() => handleNavigateToTopic(topic.id)}
                      role="link"
                      tabIndex={0}
                      onKeyDown={(event) => { if (event.key === "Enter" && event.target === event.currentTarget) { event.preventDefault(); handleNavigateToTopic(topic.id); } }}
                        className="forum-topic-card group"
                      >
                        <div className="flex-1">
                          <h3 className="forum-list-title font-bold group-hover:text-primary-dark transition-colors text-slate-900">
                            {topic.title}
                          </h3>
                          <div className="forum-metadata mt-3 text-left text-[10px] font-bold uppercase tracking-tight text-slate-400">
                            <span className="flex items-center gap-1">
                              <UserIcon className="w-3 h-3" /> {topic.authorId}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {topic.lastActivity}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="w-3.5 h-3.5" />{" "}
                              {topic.replyCount}{" "}
                              {translate("forumsPage.replies")}
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5" /> {topic.viewCount}{" "}
                              {translate("forumsPage.views")}
                            </span>
                            {canPinTopic && (
                              <button
                                type="button"
                                onClick={(event) => handleTogglePin(event, topic)}
                                disabled={
                                  isPinningTopic && pinningTopicId === topic.id
                                }
                                className={`inline-flex items-center gap-1 transition-colors cursor-pointer ${
                                  topic.isPinned
                                    ? "text-primary"
                                    : "text-slate-400 hover:text-primary"
                                }`}
                              >
                                <Pin
                                  className={`w-3.5 h-3.5 ${
                                    topic.isPinned ? "fill-primary" : ""
                                  }`}
                                />
                                {topic.isPinned
                                  ? translate("forumsPage.pinned")
                                  : translate("forumsPage.pin")}
                              </button>
                            )}
                            {(canEditTopic(topic) || canDeleteTopic(topic)) && (
                              <>
                                {canEditTopic(topic) && (
                                  <button
                                    type="button"
                                    onClick={(event) =>
                                      handleOpenEditTopic(event, topic)
                                    }
                                    className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    {translate("edit")}
                                  </button>
                                )}
                                {canDeleteTopic(topic) && (
                                  <button
                                    type="button"
                                    onClick={(event) =>
                                      confirmDeleteTopic(
                                        event,
                                        topic.id,
                                        topic.forumId,
                                      )
                                    }
                                    className="inline-flex items-center gap-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    {translate("delete")}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="hidden rounded-full bg-slate-50 p-2 text-slate-400 transition-colors group-hover:bg-primary group-hover:text-slate-900 sm:ml-4 sm:block">
                          <ArrowRight className="w-5 h-5" />
                        </div>
                      </motion.div>
                    ))}
                    <div className="forum-pagination border-t border-slate-100 pt-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {translate("forumsPage.showingTopics", {
                          count: filteredTopics.length,
                          total: forumTopicsData?.total || 0,
                        })}
                        {isTopicsFetching && !isTopicsLoading
                          ? translate("forumsPage.refreshing")
                          : ""}
                      </p>
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          {translate("forumsPage.pageOf", {
                            current: topicPage,
                            total: totalTopicPages,
                          })}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setTopicPage((currentPage) =>
                              Math.max(1, currentPage - 1),
                            )
                          }
                          className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
                          disabled={topicPage <= 1 || isTopicsFetching}
                        >
                          <ChevronLeft aria-hidden="true" className="w-4 h-4" /><span className="sr-only">{translate("contentListing.previous")}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setTopicPage((currentPage) =>
                              Math.min(totalTopicPages, currentPage + 1),
                            )
                          }
                          className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
                          disabled={
                            topicPage >= totalTopicPages || isTopicsFetching
                          }
                        >
                          <ChevronRight aria-hidden="true" className="w-4 h-4" /><span className="sr-only">{translate("contentListing.next")}</span>
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
                    <p className="text-slate-400 font-medium">
                      {translate("forumsPage.noTopicsYet")}
                    </p>
                    {canCreateTopic && (
                      <button
                        onClick={() => setIsModalOpen(true)}
                        className="mt-4 text-primary font-bold hover:underline cursor-pointer"
                      >
                        {translate("forumsPage.beFirstToPost")}
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* VIEW: POSTS (THREAD) */}
            {view === "posts" && selectedTopic && canViewForum && (
              <motion.div
                key="posts-list"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Topic Original Content */}
                {selectedTopic && (
                  <div className="forum-thread-item border-b border-slate-100 pb-5">
                    <div className="shrink-0">
                      <div className="forum-avatar bg-primary/20 rounded-2xl flex items-center justify-center font-bold text-primary-dark text-lg">
                        {selectedTopic.authorId.substring(0, 2).toUpperCase()}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="forum-thread-header">
                        <h4 className="font-bold text-slate-900">
                          {selectedTopic.authorId}
                          <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary-dark text-[8px] uppercase font-black rounded-md">
                            {translate("forumsPage.originalPoster")}
                          </span>
                        </h4>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-slate-400 font-bold uppercase">
                            {formatTopicActivity(
                              selectedTopic.createdAt,
                              localeCode,
                            )}
                          </span>
                          {(canEditTopic(selectedTopic) ||
                            canDeleteTopic(selectedTopic)) && (
                            <div className="flex items-center gap-2">
                              {canEditTopic(selectedTopic) && (
                                <button
                                  type="button"
                                  onClick={(event) =>
                                    handleOpenEditTopic(event, selectedTopic)
                                  }
                                  aria-label={translate("forumsPage.editTopic")}
                                  className="text-slate-300 hover:text-slate-600 transition-colors cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canDeleteTopic(selectedTopic) && (
                                <button
                                  type="button"
                                  onClick={(event) =>
                                    confirmDeleteTopic(
                                      event,
                                      selectedTopic.id,
                                      selectedTopic.forumId,
                                    )
                                  }
                                  aria-label={translate("forumsPage.deleteDiscussion")}
                                  className="text-slate-300 hover:text-red-500 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div
                        className="forum-rich-content forum-post-content text-slate-800 leading-relaxed font-medium bg-white rounded-2xl border-2 border-primary/20 shadow-sm shadow-primary/5 prose prose-slate max-w-none prose-p:text-slate-700 prose-headings:text-slate-900 prose-strong:text-slate-900 prose-a:text-primary prose-img:rounded-2xl"
                        dangerouslySetInnerHTML={{
                          __html: selectedTopic.content,
                        }}
                      />
                      {!!selectedTopic.attachments?.length && (
                        <AttachmentGallery
                          attachments={selectedTopic.attachments}
                          translate={translate}
                        />
                      )}
                    </div>
                  </div>
                )}
                {(isPostsLoading || isPostsFetching) && !topicPosts.length ? (
                  <PostsListSkeleton />
                ) : isPostsError ? (<p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{translate("forumUi.loadError")}</p>) : (
                  <>
                    {topicPosts.map((post, index) => (
                      <div
                        key={post.id}
                        className={`forum-thread-item ${index === 0 ? "" : "pt-5 border-t border-slate-100"}`}
                      >
                        <div className="shrink-0">
                          <div className="forum-avatar bg-slate-100 rounded-2xl flex items-center justify-center font-bold text-slate-600 text-lg">
                            {post.authorId.substring(0, 2).toUpperCase()}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="forum-thread-header">
                            <h4 className="font-bold text-slate-900">
                              {post.authorId}
                            </h4>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] text-slate-400 font-bold uppercase">
                                {formatTopicActivity(post.createdAt, localeCode)}
                              </span>
                              {(canManagePost(post, "edit") ||
                                canManagePost(post, "delete")) && (
                                <div className="flex items-center gap-2">
                                  {canManagePost(post, "edit") && (
                                    <button
                                      type="button"
                                      onClick={(event) =>
                                        handleOpenEditPost(event, post)
                                      }
                                      aria-label={translate("forumsPage.editReply")}
                                      className="text-slate-300 hover:text-slate-600 transition-colors cursor-pointer"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {canManagePost(post, "delete") && (
                                    <button
                                      type="button"
                                      onClick={(event) =>
                                        confirmDeletePost(
                                          event,
                                          post.id,
                                          post.topicId,
                                          selectedForumId || undefined,
                                        )
                                      }
                                      aria-label={translate("forumsPage.deleteReply")}
                                      className="text-slate-300 hover:text-red-500 transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <div
                            className="forum-rich-content forum-post-content text-slate-600 leading-relaxed bg-slate-50 rounded-2xl border border-slate-100 prose prose-slate max-w-none prose-p:text-slate-600 prose-headings:text-slate-900 prose-strong:text-slate-900 prose-a:text-primary prose-img:rounded-2xl"
                            dangerouslySetInnerHTML={{ __html: post.content }}
                          />
                          {!!post.attachments?.length && (
                            <AttachmentGallery
                              attachments={post.attachments}
                              translate={translate}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="forum-pagination border-t border-slate-100 pt-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {translate("forumsPage.showingReplies", {
                          count: topicPosts.length,
                          total: topicPostsData?.total || 0,
                        })}
                        {isPostsFetching && !isPostsLoading
                          ? translate("forumsPage.refreshing")
                          : ""}
                      </p>
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          {translate("forumsPage.pageOf", {
                            current: postPage,
                            total: totalPostPages,
                          })}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setPostPage((currentPage) =>
                              Math.max(1, currentPage - 1),
                            )
                          }
                          className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
                          disabled={postPage <= 1 || isPostsFetching}
                        >
                          <ChevronLeft aria-hidden="true" className="w-4 h-4" /><span className="sr-only">{translate("contentListing.previous")}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPostPage((currentPage) =>
                              Math.min(totalPostPages, currentPage + 1),
                            )
                          }
                          className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
                          disabled={postPage >= totalPostPages || isPostsFetching}
                        >
                          <ChevronRight aria-hidden="true" className="w-4 h-4" /><span className="sr-only">{translate("contentListing.next")}</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Reply area */}
                {canPostMessage && (
                  <div className="mt-6 space-y-4">
                  <div className="forum-thread-item">
                    <div className="shrink-0 mt-2">
                      <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center font-bold text-primary-dark">
                        {user?.avatarInitials}
                      </div>
                    </div>
                    <form noValidate onSubmit={handleReply} className="min-w-0 flex-1 space-y-3">
                      <TiptapEditor
                        variant="compact"
                        content={replyText}
                        onChange={(content) => setReplyText(content)}
                        placeholder={translate("forumsPage.replyPlaceholder")}
                        onImageUpload={handleImageUpload}
                      />
                      <div className="forum-thread-header">
                        <label className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">
                          <Paperclip className="w-4 h-4 text-primary" />
                          {translate("forumsPage.addFiles")}
                          <input
                            type="file"
                            multiple
                            accept="image/*,video/*,.pdf,application/pdf"
                            onChange={handleReplyFilesChange}
                            className="hidden"
                          />
                        </label>
                        {!!replyFiles.length && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {translate("forumsPage.filesSelected", {
                              count: replyFiles.length,
                            })}
                          </span>
                        )}
                      </div>
                      {!!replyFiles.length && (
                        <PendingAttachmentGallery
                          files={replyFiles}
                          onRemove={handleRemoveReplyFile}
                        />
                      )}
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={isCreatingPost}
                          className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:scale-100 cursor-pointer"
                        >
                          <Send className="w-4 h-4" />
                          {isCreatingPost
                            ? translate("forumsPage.sending")
                            : translate("forumsPage.reply")}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar */}
        <aside className="forum-side-panels">
          <div className="forum-side-panel bg-slate-900 text-white rounded-2xl shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16" />
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 relative">
              <Pin className="w-5 h-5 text-primary" />
              {translate("forumsPage.pinnedDiscussions")}
            </h3>
            <div className="space-y-4 relative">
              {isPinnedTopicsLoading ? (
                <PinnedDiscussionsSkeleton />
              ) : isPinnedTopicsError ? (<p role="alert" className="text-sm text-red-300">{translate("forumUi.loadError")}</p>) : pinnedTopics.length > 0 ? (
                pinnedTopics.map((topic) => (
                  <div
                    key={topic.id}
                    onClick={() => {
                      navigate(`/forums/${topic.forum.id}/topics/${topic.id}`);
                      window.scrollTo(0, 0);
                    }}
                    role="link"
                    tabIndex={0}
                    onKeyDown={(event) => { if (event.key === "Enter" && event.target === event.currentTarget) { event.preventDefault(); navigate(`/forums/${topic.forum.id}/topics/${topic.id}`); window.scrollTo(0, 0); } }}
                    className="group cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                          {topic.title}
                        </h4>
                        <p className="text-[10px] text-slate-500 uppercase font-bold mt-1">
                          {topic.author.first_name} •{" "}
                          {formatTopicActivity(topic.last_activity_at, localeCode)}
                        </p>
                      </div>
                      {canPinTopic && (
                        <button
                          type="button"
                          onClick={async (event) => {
                            event.stopPropagation();
                            setPinningTopicId(topic.id);

                            try {
                              await pinTopic({
                                topic_id: topic.id,
                                forum_id: topic.forum.id,
                                pinned: false,
                              }).unwrap();
                            } catch (error) {
                              toast.error(
                                getApiErrorDisplayMessage(
                                  error,
                                  translate,
                                  "apiErrors.default",
                                ),
                              );
                            } finally {
                              setPinningTopicId(null);
                            }
                          }}
                          disabled={isPinningTopic && pinningTopicId === topic.id}
                          aria-label={translate("forumsPage.unpinDiscussionAria", {
                            title: topic.title,
                          })}
                          className="shrink-0 rounded-full border border-slate-700 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300 transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                        >
                          {isPinningTopic && pinningTopicId === topic.id
                            ? translate("forumsPage.unpinning")
                            : translate("forumsPage.unpin")}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[10px] text-slate-500">
                  {translate("forumsPage.noPinnedDiscussions")}
                </p>
              )}
            </div>
          </div>

          <div className="forum-side-panel bg-white rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold mb-4 text-slate-900">
              {translate("forumsPage.latestActivity")}
            </h3>
            <div className="space-y-6">
              {(isTopicsLoading || isTopicsFetching) && !topics.length ? (
                <LatestActivitySkeleton />
              ) : isTopicsError ? (<p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{translate("forumUi.loadError")}</p>) : !topics.length ? (<p className="text-sm text-slate-500">{translate("forumUi.noActivity")}</p>) : (
                <AnimatePresence mode="popLayout">
                  {topics.slice(0, 5).map((topic) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      key={topic.id}
                      onClick={() => handleNavigateToTopic(topic.id)}
                      role="link"
                      tabIndex={0}
                      onKeyDown={(event) => { if (event.key === "Enter" && event.target === event.currentTarget) { event.preventDefault(); handleNavigateToTopic(topic.id); } }}
                      className="space-y-2 group relative group cursor-pointer"
                    >
                      <div className="flex min-w-0 flex-wrap justify-between items-start gap-2">
                        <span className="px-2 py-0.5 bg-slate-50 border border-slate-100 rounded text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                          {forums.find((f) => f.id === topic.forumId)?.name ||
                            translate("forumsPage.general")}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {topic.lastActivity}
                          </span>
                          {(canEditTopic(topic) || canDeleteTopic(topic)) && (
                            <div className="flex items-center gap-2 transition-all">
                              {canEditTopic(topic) && (
                                <button
                                  onClick={(e) => handleOpenEditTopic(e, topic)}
                                  aria-label={translate("forumsPage.editTopic")}
                                  className="text-slate-300 hover:text-slate-600 transition-all cursor-pointer"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              )}
                              {canDeleteTopic(topic) && (
                                <button
                                  onClick={(e) =>
                                    confirmDeleteTopic(e, topic.id, topic.forumId)
                                  }
                                  aria-label={translate("forumsPage.deleteDiscussion")}
                                  className="text-slate-300 hover:text-red-500 transition-all cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <h4 className="text-sm font-bold group-hover:text-primary-dark transition-colors leading-snug text-slate-900">
                        {topic.title}
                      </h4>
                      <div className="forum-metadata text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3.5 h-3.5" />{" "}
                          {topic.replyCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" /> {topic.viewCount}
                        </span>
                        <span className="text-slate-900 ml-auto">
                          {topic.authorId}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>
        </aside>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={translate("forumsPage.newDiscussionTopic")}
        layout="compact"
        className="article-forum-modal"
        footer={(<ModalSubmitButton formId="forum-new-discussion-form"
          disabled={isCreatingTopic}
          className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all cursor-pointer"
        >
          {isCreatingTopic
            ? translate("forumsPage.publishing")
            : translate("forumsPage.publishTopic")}
        </ModalSubmitButton>)}
      >
        <form id="forum-new-discussion-form" noValidate onSubmit={handleAddTopic} className="article-forum-modal-form">
          <ModalFieldGrid>
            <div className="space-y-2">
              <label htmlFor="forum-new-discussion-form-field-1" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {translate("forumsPage.discussionTitle")}
              </label>
              <input id="forum-new-discussion-form-field-1"
                required
                autoFocus
                type="text"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="forum-new-discussion-form-field-2" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {translate("forumsPage.forum")}
              </label>
              <select id="forum-new-discussion-form-field-2"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                value={formData.forumId}
                onChange={(e) =>
                  setFormData({ ...formData, forumId: e.target.value })
                }
              >
                {forums.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </ModalFieldGrid>
          <div role="group" aria-labelledby="forum-new-discussion-form-field-3-label" className="space-y-2">
            <label id="forum-new-discussion-form-field-3-label" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {translate("forumsPage.content")}
            </label>
            <TiptapEditor
              variant="compact"
              content={formData.content}
              onChange={(content) =>
                setFormData({ ...formData, content: content })
              }
              placeholder={translate("forumsPage.topicContentPlaceholder")}
              onImageUpload={handleImageUpload}
            />
          </div>
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              {translate("forumsPage.attachments")}
            </label>
            <FileUploadDropzone
              presentation="compact"
              inputId="forum-topic-files"
              title={translate("forumsPage.addFile")}
              hint="Images, videos, PDFs"
              selectedLabel={
                topicFiles.length
                  ? translate("forumsPage.filesSelected", {
                    count: topicFiles.length,
                  })
                  : undefined
              }
              onFilesSelected={handleTopicFilesChange}
              preview={
                topicFiles.length ? (
                  <SelectedFilesPreview
                    presentation="compact"
                    files={topicFiles}
                    onRemove={handleRemoveTopicFile}
                  />
                ) : undefined
              }
            />
          </div>
        </form>
      </Modal>
      <Modal
        isOpen={isNewForumModalOpen}
        onClose={() => setIsNewForumModalOpen(false)}
        title={translate("forumsPage.createNewForum")}
        layout="compact"
        className="article-forum-modal"
        footer={(<div className="article-forum-modal-actions">
          <button type="button" onClick={() => setIsNewForumModalOpen(false)} className="content-page-button content-page-button-secondary">{translate("common.cancel")}</button>
          <ModalSubmitButton formId="forum-create-form"
            disabled={isCreatingForum}
            className="content-page-button content-page-button-primary disabled:opacity-50"
          >
            {isCreatingForum
              ? translate("forumsPage.creating")
              : translate("forumsPage.createForum")}
          </ModalSubmitButton>
        </div>)}
      >
        <form id="forum-create-form" noValidate onSubmit={handleAddForum} className="article-forum-modal-form">
          <ModalFieldGrid>
            <div className="space-y-2">
              <label htmlFor="forum-create-form-field-1" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {translate("forumsPage.forumName")}
              </label>
              <input id="forum-create-form-field-1"
                required
                autoFocus
                type="text"
                placeholder={translate("forumsPage.forumNamePlaceholder")}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                value={newForumData.name}
                onChange={(e) =>
                  setNewForumData({ ...newForumData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="forum-create-form-field-2" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {translate("forumsPage.responsibleAuthor")}
              </label>
              <input id="forum-create-form-field-2"
                type="text"
                placeholder={translate("forumsPage.authorPlaceholder")}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                value={newForumData.author_name}
                onChange={(e) =>
                  setNewForumData({
                    ...newForumData,
                    author_name: e.target.value,
                  })
                }
              />
            </div>
          </ModalFieldGrid>
          <div role="group" aria-labelledby="forum-create-form-field-3-label" className="space-y-2">
            <label id="forum-create-form-field-3-label" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {translate("forumsPage.description")}
            </label>
            <TiptapEditor
              variant="compact"
              content={newForumData.description}
              onChange={(content) =>
                setNewForumData({
                  ...newForumData,
                  description: content,
                })
              }
              placeholder={translate("forumsPage.forumDescriptionPlaceholder")}
              onImageUpload={handleImageUpload}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {translate("forumsPage.thumbnailLabel")}
            </label>
            <div className="min-w-0">
              <FileUploadDropzone
                presentation="compact"
                inputId="forum-thumbnail-create"
                title={translate("forumsPage.uploadThumbnail")}
                hint={translate("articlesPage.thumbnailHelp")}
                accept="image/*"
                multiple={false}
                selectedLabel={
                  newForumData.thumbnail
                    ? newForumData.thumbnail.name
                    : newForumData.thumbnail_url
                      ? translate("forumsPage.replaceThumbnail")
                      : undefined
                }
                onFilesSelected={(files) =>
                  setNewForumData((prev) => ({
                    ...prev,
                    thumbnail: files[0] || null,
                    thumbnail_url: prev.thumbnail_url,
                  }))
                }
                preview={
                  newForumData.thumbnail || newForumData.thumbnail_url ? (
                    <FilePreviewCard
                      presentation="compact"
                      file={newForumData.thumbnail}
                      url={newForumData.thumbnail_url || undefined}
                      name={
                        newForumData.thumbnail?.name ||
                        translate("forumsPage.forumThumbnail")
                      }
                      onRemove={() =>
                        setNewForumData((prev) => ({
                          ...prev,
                          thumbnail: null,
                          thumbnail_url: null,
                        }))
                      }
                    />
                  ) : undefined
                }
              />
            </div>
          </div>
        </form>
      </Modal>
      <Modal
        isOpen={isEditForumModalOpen}
        onClose={() => {
          setIsEditForumModalOpen(false);
          setEditForumData(getDefaultForumFormData());
        }}
        title={translate("forumsPage.editForum")}
        layout="compact"
        className="article-forum-modal"
        footer={(<ModalSubmitButton formId="forum-edit-form"
          disabled={isUpdatingForum}
          className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all uppercase tracking-widest cursor-pointer"
        >
          {isUpdatingForum
            ? translate("forumsPage.saving")
            : translate("forumsPage.saveForum")}
        </ModalSubmitButton>)}
      >
        <form id="forum-edit-form" noValidate onSubmit={handleUpdateForum} className="article-forum-modal-form">
          <ModalFieldGrid>
            <ModalFullWidth>
              <div className="space-y-2">
                <label htmlFor="forum-edit-form-field-1" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {translate("forumsPage.forumName")}
                </label>
                <input id="forum-edit-form-field-1"
                  required
                  autoFocus
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  value={editForumData.name}
                  onChange={(e) =>
                    setEditForumData({ ...editForumData, name: e.target.value })
                  }
                />
              </div>
            </ModalFullWidth>
            <div className="space-y-2">
              <label htmlFor="forum-edit-form-field-2" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {translate("forumsPage.type")}
              </label>
              <select id="forum-edit-form-field-2"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                value={editForumData.forum_type}
                onChange={(e) =>
                  setEditForumData({
                    ...editForumData,
                    forum_type: e.target.value,
                  })
                }
              >
                {!["general", "professionnel", "commission"].includes(editForumData.forum_type) ? <option value={editForumData.forum_type}>{editForumData.forum_type}</option> : null}
                <option value="general">
                  {translate("forumsPage.typeGeneral")}
                </option>
                <option value="professionnel">
                  {translate("forumsPage.typeProfessional")}
                </option>
                <option value="commission">
                  {translate("forumsPage.typeCommission")}
                </option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="forum-edit-form-field-3" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {translate("forumsPage.responsibleAuthor")}
              </label>
              <input id="forum-edit-form-field-3"
                type="text"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                value={editForumData.author_name}
                onChange={(e) =>
                  setEditForumData({
                    ...editForumData,
                    author_name: e.target.value,
                  })
                }
              />
            </div>
          </ModalFieldGrid>
          <div role="group" aria-labelledby="forum-edit-form-field-4-label" className="space-y-2">
            <label id="forum-edit-form-field-4-label" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {translate("forumsPage.description")}
            </label>
            <TiptapEditor
              variant="compact"
              content={editForumData.description}
              onChange={(content) =>
                setEditForumData({
                  ...editForumData,
                  description: content,
                })
              }
              onImageUpload={handleImageUpload}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {translate("forumsPage.thumbnailLabel")}
            </label>
            <div className="min-w-0">
              <FileUploadDropzone
                presentation="compact"
                inputId="forum-thumbnail-edit"
                title={translate("forumsPage.uploadThumbnail")}
                hint={translate("articlesPage.thumbnailHelp")}
                accept="image/*"
                multiple={false}
                selectedLabel={
                  editForumData.thumbnail
                    ? editForumData.thumbnail.name
                    : editForumData.thumbnail_url
                      ? translate("forumsPage.replaceThumbnail")
                      : undefined
                }
                onFilesSelected={(files) =>
                  setEditForumData((prev) => ({
                    ...prev,
                    thumbnail: files[0] || null,
                    thumbnail_url: files[0] ? null : prev.thumbnail_url,
                  }))
                }
                preview={
                  editForumData.thumbnail || editForumData.thumbnail_url ? (
                    <FilePreviewCard
                      presentation="compact"
                      file={editForumData.thumbnail}
                      url={editForumData.thumbnail_url || undefined}
                      name={
                        editForumData.thumbnail?.name ||
                        translate("forumsPage.forumThumbnail")
                      }
                      onRemove={
                        editForumData.thumbnail
                          ? () =>
                            setEditForumData((prev) => ({
                              ...prev,
                              thumbnail: null,
                            }))
                          : undefined
                      }
                    />
                  ) : undefined
                }
              />
            </div>
          </div>
        </form>
      </Modal>
      {/* EDIT TOPIC MODAL */}
      <Modal
        isOpen={isEditTopicModalOpen}
        onClose={() => {
          setIsEditTopicModalOpen(false);
          setEditTopicFiles([]);
          setInitialEditTopicData(null);
          setEditTopicData({
            id: "",
            forumId: "",
            title: "",
            content: "",
            attachments: [],
            deleteFiles: [],
          });
        }}
        title={translate("forumsPage.editTopic")}
        layout="compact"
        className="article-forum-modal"
        footer={(<ModalSubmitButton formId="forum-edit-discussion-form"
          disabled={isUpdatingTopic}
          className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all uppercase tracking-widest cursor-pointer"
        >
          {isUpdatingTopic
            ? translate("forumsPage.saving")
            : translate("forumsPage.saveTopic")}
        </ModalSubmitButton>)}
      >
        <form id="forum-edit-discussion-form" noValidate onSubmit={handleUpdateTopic} className="article-forum-modal-form">
          <div className="space-y-2">
            <label htmlFor="forum-edit-discussion-form-field-1" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {translate("forumsPage.discussionTitle")}
            </label>
            <input id="forum-edit-discussion-form-field-1"
              required
              type="text"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              value={editTopicData.title}
              onChange={(e) =>
                setEditTopicData({ ...editTopicData, title: e.target.value })
              }
            />
          </div>
          <div role="group" aria-labelledby="forum-edit-discussion-form-field-2-label" className="space-y-2">
            <label id="forum-edit-discussion-form-field-2-label" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {translate("forumsPage.content")}
            </label>
            <TiptapEditor
              variant="compact"
              content={editTopicData.content}
              onChange={(content) =>
                setEditTopicData({ ...editTopicData, content: content })
              }
              onImageUpload={handleImageUpload}
            />
          </div>
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              {translate("forumsPage.attachments")}
            </label>
            {!!editTopicData.attachments.length && (
              <ModalFieldGrid>
                {editTopicData.attachments.map((url, index) => (
                  <FilePreviewCard
                    presentation="compact"
                    key={`${url}-${index}`}
                    url={url}
                    href={url}
                    name={getAttachmentInfo(url).filename || translate("forumsPage.existingFile", { count: index + 1 })}
                    subtitle={translate("forumsPage.openFile")}
                    onRemove={() => handleRemoveExistingAttachment(url)}
                  />
                ))}
              </ModalFieldGrid>
            )}
            <FileUploadDropzone
              presentation="compact"
              inputId="forum-edit-topic-files"
              title={translate("forumsPage.addFile")}
              hint="Images, videos, PDFs"
              selectedLabel={
                editTopicFiles.length
                  ? translate("forumsPage.filesSelected", {
                    count: editTopicFiles.length,
                  })
                  : undefined
              }
              onFilesSelected={handleEditTopicFilesChange}
              preview={editTopicFiles.length ? (<SelectedFilesPreview
                presentation="compact"
                files={editTopicFiles}
                onRemove={handleRemoveEditTopicFile}
              />) : undefined}
            />
          </div>
        </form>
      </Modal>
      {/* EDIT REPLY MODAL */}
      <Modal
        isOpen={isEditPostModalOpen}
        onClose={() => setIsEditPostModalOpen(false)}
        title={translate("forumsPage.editReply")}
        layout="compact"
        className="article-forum-modal"
        footer={(<ModalSubmitButton formId="forum-edit-reply-form"
          disabled={isUpdatingPost}
          className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all uppercase tracking-widest disabled:opacity-50 cursor-pointer"
        >
          {isUpdatingPost
            ? translate("forumsPage.saving")
            : translate("forumsPage.saveReply")}
        </ModalSubmitButton>)}
      >
        <form id="forum-edit-reply-form" noValidate onSubmit={handleUpdatePost} className="article-forum-modal-form">
          <div role="group" aria-labelledby="forum-edit-reply-form-field-1-label" className="space-y-2">
            <label id="forum-edit-reply-form-field-1-label" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {translate("forumsPage.content")}
            </label>
            <TiptapEditor
              variant="compact"
              content={editPostData.content}
              onChange={(content) =>
                setEditPostData({ ...editPostData, content: content })
              }
              onImageUpload={handleImageUpload}
            />
          </div>
          {!!editPostData.attachments.length && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {translate("forumsPage.existingAttachments")}
              </label>
              <ModalFieldGrid>
                {editPostData.attachments.map((url, index) => (
                  <FilePreviewCard
                    presentation="compact"
                    key={`${url}-${index}`}
                    url={url}
                    href={url}
                    name={getAttachmentInfo(url).filename}
                  />
                ))}
              </ModalFieldGrid>
            </div>
          )}
          <div className="space-y-3">
            <FileUploadDropzone
              presentation="compact"
              inputId="forum-edit-post-files"
              title={translate("forumsPage.addFiles")}
              hint="Images, videos, PDFs"
              accept="image/*,video/*,.pdf,application/pdf"
              selectedLabel={
                editPostFiles.length
                  ? translate("forumsPage.filesSelected", {
                    count: editPostFiles.length,
                  })
                  : undefined
              }
              onFilesSelected={handleEditPostFilesChange}
              preview={editPostFiles.length ? (<SelectedFilesPreview
                presentation="compact"
                files={editPostFiles}
                onRemove={handleRemoveEditPostFile}
              />) : undefined}
            />
          </div>
        </form>
      </Modal>

      <ConfirmModal
        presentation="compact"
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDeleteItem}
        title={
          deleteTarget?.kind === "forum"
            ? translate("forumsPage.deleteForum")
            : deleteTarget?.kind === "post"
              ? translate("forumsPage.deleteReply")
              : translate("forumsPage.deleteDiscussion")
        }
        message={
          deleteTarget?.kind === "forum"
            ? translate("forumsPage.deleteForumMessage")
            : deleteTarget?.kind === "post"
              ? translate("forumsPage.deleteReplyMessage")
              : translate("forumsPage.deleteDiscussionMessage")
        }
        isLoading={isDeletingItem}
      />
    </div>
  );
}
