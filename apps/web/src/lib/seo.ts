const DEFAULT_TITLE = "Inko | Learn Languages by Typing";
const DEFAULT_DESCRIPTION =
  "Practice vocabulary with typing-first drills, spaced repetition, audio support, and progress tracking.";

type MetadataInput = {
  title?: string;
  description?: string;
  path?: string;
  robots?: string;
  type?: "website" | "article";
};

function ensureMeta(selector: string, create: () => HTMLMetaElement | HTMLLinkElement) {
  let node = document.head.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
  if (!node) {
    node = create();
    document.head.appendChild(node);
  }
  return node;
}

function getSiteUrl() {
  const envSiteUrl = import.meta.env.VITE_SITE_URL?.trim();
  if (envSiteUrl) {
    return envSiteUrl.replace(/\/+$/, "");
  }
  return window.location.origin.replace(/\/+$/, "");
}

function setMetaName(name: string, content: string) {
  const node = ensureMeta(`meta[name="${name}"]`, () => {
    const meta = document.createElement("meta");
    meta.name = name;
    return meta;
  }) as HTMLMetaElement;
  node.content = content;
}

function setMetaProperty(property: string, content: string) {
  const node = ensureMeta(`meta[property="${property}"]`, () => {
    const meta = document.createElement("meta");
    meta.setAttribute("property", property);
    return meta;
  }) as HTMLMetaElement;
  node.content = content;
}

function setCanonical(url: string) {
  const node = ensureMeta('link[rel="canonical"]', () => {
    const link = document.createElement("link");
    link.rel = "canonical";
    return link;
  }) as HTMLLinkElement;
  node.href = url;
}

export function applyMetadata({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  robots = "index,follow",
  type = "website",
}: MetadataInput) {
  const canonicalUrl = new URL(path, `${getSiteUrl()}/`).toString();

  document.title = title;
  setCanonical(canonicalUrl);
  setMetaName("description", description);
  setMetaName("robots", robots);
  setMetaProperty("og:type", type);
  setMetaProperty("og:title", title);
  setMetaProperty("og:description", description);
  setMetaProperty("og:url", canonicalUrl);
  setMetaName("twitter:title", title);
  setMetaName("twitter:description", description);
}

export function applyNoIndexMetadata(title: string, description = DEFAULT_DESCRIPTION) {
  applyMetadata({
    title,
    description,
    path: window.location.pathname,
    robots: "noindex,nofollow",
  });
}
