export type DocumentRecord = {
  id: string
  path: string | null
  saved: string
  draft: string
}

const RECENT_KEY = "simple-write-recent"
const THEME_KEY = "simple-write-theme"

export type ThemeChoice = "system" | "light" | "dark"

export function createDocument(path: string | null = null, text = ""): DocumentRecord {
  return {
    id: crypto.randomUUID(),
    path,
    saved: text,
    draft: text,
  }
}

export function isDirty(document: Pick<DocumentRecord, "saved" | "draft">) {
  return document.draft !== document.saved
}

export function fileTitle(path: string | null) {
  if (!path) return "Untitled"
  const parts = path.split(/[/\\]/)
  return parts.at(-1) || "Untitled"
}

export function wordCount(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

export function markdownImage(alt: string, src: string) {
  const safeAlt = alt.replaceAll("[", "\\[").replaceAll("]", "\\]")
  const destination = /[\s()]/.test(src) ? `<${src}>` : src
  return `![${safeAlt}](${destination})`
}

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp"])

export function isImagePath(path: string) {
  const extension = path.split(".").pop()?.toLowerCase()
  return extension ? IMAGE_EXTENSIONS.has(extension) : false
}

export function prefersRaw(text: string) {
  return /<\/?[a-z][^>\n]*>/i.test(text)
}

export function findMatches(text: string, query: string) {
  if (!query) return []
  const matches: number[] = []
  const needle = query.toLowerCase()
  const haystack = text.toLowerCase()
  let index = 0
  while (index <= haystack.length - needle.length) {
    const found = haystack.indexOf(needle, index)
    if (found === -1) break
    matches.push(found)
    index = found + needle.length
  }
  return matches
}

export function loadRecent() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === "string").slice(0, 8)
  } catch {
    return []
  }
}

export function rememberRecent(path: string, current = loadRecent()) {
  const next = [path, ...current.filter((item) => item !== path)].slice(0, 8)
  localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  return next
}

export function loadTheme(): ThemeChoice {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === "light" || stored === "dark" || stored === "system") return stored
  return "system"
}

export function saveTheme(theme: ThemeChoice) {
  localStorage.setItem(THEME_KEY, theme)
}
