import { fileTitle } from "@/lib/documents"

const memory = new Map<string, string>()

export function isDesktop() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
}

function browserPath(name: string) {
  return `/browser/${crypto.randomUUID()}/${name}`
}

function chooseFiles(accept: string, multiple: boolean) {
  return new Promise<File[]>((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = accept
    input.multiple = multiple
    input.addEventListener("change", () => resolve([...(input.files ?? [])]))
    input.click()
  })
}

function download(name: string, contents: string) {
  const blob = new Blob([contents], { type: "text/markdown" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

async function readFileAsDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export async function pickOpen() {
  if (isDesktop()) {
    const { open } = await import("@tauri-apps/plugin-dialog")
    const selected = await open({
      multiple: true,
      filters: [{ name: "Text", extensions: ["md", "markdown", "txt"] }],
    })
    if (selected === null) return null
    return Array.isArray(selected) ? selected : [selected]
  }

  const files = await chooseFiles(".md,.markdown,.txt,text/plain", true)
  if (!files.length) return null
  const paths: string[] = []
  for (const file of files) {
    const path = browserPath(file.name)
    memory.set(path, await file.text())
    paths.push(path)
  }
  return paths
}

export async function pickSave(suggested: string) {
  if (isDesktop()) {
    const { save } = await import("@tauri-apps/plugin-dialog")
    return await save({
      defaultPath: suggested,
      filters: [{ name: "Markdown", extensions: ["md"] }],
    })
  }

  const name = window.prompt("Save as", fileTitle(suggested))
  if (!name) return null
  const path = browserPath(name.endsWith(".md") ? name : `${name}.md`)
  return path
}

export async function rememberBrowserFile(file: File) {
  const path = browserPath(file.name)
  memory.set(path, await file.text())
  return path
}

export async function readBrowserImage(file: File) {
  return await readFileAsDataUrl(file)
}

export async function pickImage() {
  if (isDesktop()) {
    const { open } = await import("@tauri-apps/plugin-dialog")
    const selected = await open({
      multiple: false,
      filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp"] }],
    })
    return typeof selected === "string" ? selected : null
  }

  const [file] = await chooseFiles("image/*", false)
  if (!file) return null
  return await readFileAsDataUrl(file)
}

export async function readText(path: string) {
  if (memory.has(path)) return memory.get(path) ?? ""
  const { invoke } = await import("@tauri-apps/api/core")
  return await invoke<string>("read_text", { path })
}

export async function writeText(path: string, contents: string) {
  memory.set(path, contents)
  if (!isDesktop() || path.startsWith("/browser/")) {
    download(fileTitle(path), contents)
    return
  }
  const { invoke } = await import("@tauri-apps/api/core")
  await invoke("write_text", { path, contents })
}

export async function importImage(documentPath: string, source: string) {
  if (source.startsWith("data:")) return source
  const { invoke } = await import("@tauri-apps/api/core")
  return await invoke<string>("import_image", { documentPath, sourcePath: source })
}

export async function imageDataUrl(documentPath: string | null, reference: string) {
  if (reference.startsWith("data:") || reference.startsWith("http://") || reference.startsWith("https://")) {
    return reference
  }
  if (!documentPath || documentPath.startsWith("/browser/")) return null
  const { invoke } = await import("@tauri-apps/api/core")
  return await invoke<string>("image_data_url", { documentPath, reference })
}

export async function resolveWikilink(documentPath: string | null, target: string) {
  if (!documentPath || documentPath.startsWith("/browser/")) return null
  const { invoke } = await import("@tauri-apps/api/core")
  return await invoke<string | null>("resolve_wikilink", { documentPath, target })
}

export async function takeLaunchPaths() {
  if (!isDesktop()) return []
  const { invoke } = await import("@tauri-apps/api/core")
  return await invoke<string[]>("take_launch_paths")
}

export async function listenForDrops(onDrop: (paths: string[]) => void) {
  if (!isDesktop()) return () => {}
  const { getCurrentWebview } = await import("@tauri-apps/api/webview")
  return await getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type !== "drop") return
    onDrop(event.payload.paths)
  })
}

export async function setWindowTitle(title: string) {
  if (!isDesktop()) {
    document.title = title
    return
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window")
  await getCurrentWindow().setTitle(title)
}

export async function listenForClose(onClose: () => Promise<boolean>) {
  if (!isDesktop()) return () => {}
  const { getCurrentWindow } = await import("@tauri-apps/api/window")
  return await getCurrentWindow().onCloseRequested(async (event) => {
    event.preventDefault()
    const shouldClose = await onClose()
    if (shouldClose) await getCurrentWindow().destroy()
  })
}
