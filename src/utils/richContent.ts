import { getYouTubeEmbedUrl } from "./youtube";

// Match the editor's paragraphs, formatting, lists, tables, images and YouTube
// blocks, plus ordinary HTML media. Do not pass arbitrary active HTML to React.
const ALLOWED_TAGS = new Set("p div span section article h1 h2 h3 h4 h5 h6 br hr strong b em i u s strike del ins mark small sub sup blockquote ul ol li dl dt dd a img figure figcaption picture source video audio iframe table caption colgroup col thead tbody tfoot tr th td pre code kbd samp var abbr time details summary address".split(" "));
const DROP_CONTENT = new Set("script style template noscript object embed applet form input button textarea select option base meta link svg math".split(" "));
const ATTRIBUTES: Record<string, string[]> = {
  a: ["href", "target", "download", "hreflang", "rel", "referrerpolicy"],
  img: ["src", "alt", "width", "height", "loading", "referrerpolicy"],
  iframe: ["src", "width", "height", "allowfullscreen", "sandbox", "allow", "loading", "referrerpolicy"],
  video: ["src", "poster", "controls", "loop", "muted", "preload", "width", "height"],
  audio: ["src", "controls", "loop", "muted", "preload"],
  source: ["src", "type", "media"],
  ol: ["start", "reversed", "type"],
  li: ["value"],
  td: ["colspan", "rowspan", "colwidth"],
  th: ["colspan", "rowspan", "scope", "colwidth"],
  col: ["span", "width"],
  time: ["datetime"],
  details: ["open"],
  div: ["data-youtube-video"],
};

function isSafeUrl(value: string, image = false, link = false) {
  if (image && /^data:image\/(?:png|jpeg|gif|webp|avif|bmp);base64,[a-z0-9+/=\s]+$/i.test(value)) return true;
  try {
    const parsed = new URL(value, window.location.href);
    return ["http:", "https:", ...(link ? ["mailto:", "tel:"] : [])].includes(parsed.protocol)
      || (parsed.protocol === "blob:" && parsed.origin === window.location.origin);
  } catch { return false; }
}

export function sanitizeRichContent(html: string): string {
  const document = new DOMParser().parseFromString(html, "text/html");
  const visit = (parent: Element) => {
    for (const element of Array.from(parent.children)) {
      const tag = element.localName;
      if (element.namespaceURI !== "http://www.w3.org/1999/xhtml" || DROP_CONTENT.has(tag)) {
        element.remove();
        continue;
      }
      visit(element);
      if (!ALLOWED_TAGS.has(tag)) { element.replaceWith(...element.childNodes); continue; }
      const allowed = new Set(["title", "lang", "dir", ...(ATTRIBUTES[tag] || [])]);
      // Preserve safe editor formatting, without allowing arbitrary CSS URLs,
      // positioning, selectors, scripts or application classes.
      const style = element instanceof HTMLElement ? element.style : null;
      const styles: string[] = [];
      for (const property of ["text-align", "color", "background-color", "width", "height", "vertical-align"]) {
        const value = style?.getPropertyValue(property).trim();
        if (!value) continue;
        const valid = property === "text-align" ? /^(left|right|center|justify|start|end)$/i.test(value)
          : property === "vertical-align" ? /^(top|middle|bottom|baseline)$/i.test(value)
          : property.includes("color") ? /^(#[a-f0-9]{3,8}|[a-z]+|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\))$/i.test(value)
          : /^(auto|\d+(?:\.\d+)?(?:px|%|em|rem))$/i.test(value);
        if (valid) styles.push(`${property}: ${value}`);
      }
      const codeClass = tag === "code" ? element.getAttribute("class")?.split(/\s+/).filter((value) => /^language-[\w-]+$/.test(value)).join(" ") : "";
      for (const attribute of Array.from(element.attributes)) {
        if (!allowed.has(attribute.name)) element.removeAttribute(attribute.name);
      }
      if (styles.length) element.setAttribute("style", styles.join("; "));
      if (codeClass) element.setAttribute("class", codeClass);
      if (tag === "div" && element.hasAttribute("data-youtube-video")) element.setAttribute("class", "youtube-embed");
      for (const attribute of ["href", "src", "poster"]) {
        const value = element.getAttribute(attribute);
        if (value && !isSafeUrl(value, tag === "img" || attribute === "poster", attribute === "href")) element.removeAttribute(attribute);
      }
      if (tag === "a") {
        if (!["_blank", "_self", "_parent", "_top"].includes(element.getAttribute("target") || "")) element.removeAttribute("target");
        if (element.getAttribute("target") === "_blank") {
          const rel = new Set((element.getAttribute("rel") || "").split(/\s+/).filter(Boolean));
          rel.add("noopener"); rel.add("noreferrer");
          element.setAttribute("rel", [...rel].join(" "));
        }
      }
      if (tag === "iframe") {
        const source = element.getAttribute("src") || "";
        // The editor supports YouTube embeds; other safe external frames remain
        // available as links instead of executing arbitrary embedded documents.
        let directEmbed: string | null = null;
        try {
          const url = new URL(source);
          if (url.protocol === "https:" && ["youtube.com", "www.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(url.hostname) && /^\/embed\/[a-z0-9_-]+\/?$/i.test(url.pathname)) directEmbed = url.toString();
        } catch { /* Other safe sources remain accessible as links below. */ }
        const youtube = directEmbed || getYouTubeEmbedUrl(source);
        if (!youtube) {
          if (source) {
            const link = document.createElement("a");
            link.href = source;
            link.textContent = element.getAttribute("title") || source;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            element.replaceWith(link);
          } else element.remove();
          continue;
        }
        element.setAttribute("src", youtube);
        element.setAttribute("title", element.getAttribute("title") || "YouTube");
        element.setAttribute("allowfullscreen", "");
        if (!element.hasAttribute("allow")) element.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
        if (!element.hasAttribute("referrerpolicy")) element.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      }
    }
  };
  visit(document.body);
  return document.body.innerHTML;
}
