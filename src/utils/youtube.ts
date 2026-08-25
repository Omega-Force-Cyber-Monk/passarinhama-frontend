const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

const getStartTimeInSeconds = (value: string | null) => {
  if (!value) {
    return 0;
  }

  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  const match = value.match(
    /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i,
  );

  if (!match) {
    return 0;
  }

  const [, hours = "0", minutes = "0", seconds = "0"] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
};

export const extractYouTubeVideoId = (value: string) => {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();

    if (!YOUTUBE_HOSTS.has(host)) {
      return null;
    }

    if (host.includes("youtu.be")) {
      const [videoId] = url.pathname.split("/").filter(Boolean);
      return videoId || null;
    }

    const searchVideoId = url.searchParams.get("v");
    if (searchVideoId) {
      return searchVideoId;
    }

    const segments = url.pathname.split("/").filter(Boolean);
    const embedIndex = segments.findIndex((segment) =>
      ["embed", "shorts", "live"].includes(segment),
    );

    if (embedIndex >= 0) {
      return segments[embedIndex + 1] || null;
    }

    return null;
  } catch {
    return null;
  }
};

export const getYouTubeEmbedUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    const videoId = extractYouTubeVideoId(value);

    if (!videoId) {
      return null;
    }

    const start =
      getStartTimeInSeconds(url.searchParams.get("t")) ||
      getStartTimeInSeconds(url.searchParams.get("start"));

    const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`);
    embedUrl.searchParams.set("rel", "0");

    if (start > 0) {
      embedUrl.searchParams.set("start", String(start));
    }

    return embedUrl.toString();
  } catch {
    return null;
  }
};

export const isYouTubeUrl = (value: string) => Boolean(getYouTubeEmbedUrl(value));
