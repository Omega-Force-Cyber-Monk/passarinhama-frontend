import { mergeAttributes, Node } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { getYouTubeEmbedUrl } from "../../../utils/youtube";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    youTubeEmbed: {
      setYouTubeEmbed: (options: { url: string }) => ReturnType;
    };
  }
}

const YOUTUBE_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

const replaceCurrentTextblockWithEmbed = (view: Parameters<NonNullable<Plugin["props"]>["handlePaste"]>[0]) => {
  const { state } = view;
  const { selection } = state;

  if (!selection.empty) {
    return false;
  }

  const { $from } = selection;
  const parent = $from.parent;

  if (!parent.isTextblock) {
    return false;
  }

  const text = parent.textContent.trim();
  const embedUrl = getYouTubeEmbedUrl(text);

  if (!embedUrl) {
    return false;
  }

  const from = $from.start();
  const to = from + parent.nodeSize - 2;
  const node = view.state.schema.nodes.youTubeEmbed?.create({
    src: embedUrl,
    originalUrl: text,
  });

  if (!node) {
    return false;
  }

  view.dispatch(view.state.tr.replaceWith(from, to, node).scrollIntoView());
  return true;
};

const YouTubeEmbed = Node.create({
  name: "youTubeEmbed",

  group: "block",

  atom: true,

  draggable: true,

  selectable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      originalUrl: {
        default: null,
      },
      title: {
        default: "YouTube video player",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-youtube-video]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(
        {
          "data-youtube-video": "true",
          class: "youtube-embed",
        },
        this.options.HTMLAttributes,
      ),
      [
        "iframe",
        {
          src: HTMLAttributes.src,
          title: HTMLAttributes.title,
          allow: YOUTUBE_ALLOW,
          allowfullscreen: "true",
          frameborder: "0",
          loading: "lazy",
          referrerpolicy: "strict-origin-when-cross-origin",
        },
      ],
    ];
  },

  addCommands() {
    return {
      setYouTubeEmbed:
        ({ url }) =>
        ({ commands }) => {
          const embedUrl = getYouTubeEmbedUrl(url);

          if (!embedUrl) {
            return false;
          }

          return commands.insertContent({
            type: this.name,
            attrs: {
              src: embedUrl,
              originalUrl: url,
            },
          });
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handlePaste: (view, event) => {
            const pastedText = event.clipboardData?.getData("text/plain")?.trim();

            if (!pastedText) {
              return false;
            }

            const embedUrl = getYouTubeEmbedUrl(pastedText);

            if (!embedUrl) {
              return false;
            }

            event.preventDefault();

            const node = this.type.create({
              src: embedUrl,
              originalUrl: pastedText,
            });

            view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView());
            return true;
          },
          handleKeyDown: (view, event) => {
            if (event.key !== " " && event.key !== "Enter") {
              return false;
            }

            return replaceCurrentTextblockWithEmbed(view);
          },
        },
      }),
    ];
  },
});

export default YouTubeEmbed;
