import { useEffect, useRef, useState, type DragEvent } from "react"
import { EllipsisIcon, FilePlusIcon, FolderOpenIcon, SaveIcon, XIcon } from "lucide-react"
import { editorBridge } from "@/editor/bridge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { TooltipProvider } from "@/components/ui/tooltip"
import { WriteEditor, type WriteEditorHandle } from "@/components/write-editor"
import { cn } from "@/lib/utils"
import {
  createDocument,
  fileTitle,
  isDirty,
  isImagePath,
  loadRecent,
  loadTheme,
  prefersRaw,
  rememberRecent,
  saveTheme,
  wordCount,
  type DocumentRecord,
  type ThemeChoice,
} from "@/lib/documents"
import {
  importImage,
  isDesktop,
  listenForClose,
  listenForDrops,
  pickImage,
  pickOpen,
  pickSave,
  readBrowserImage,
  readText,
  rememberBrowserFile,
  resolveWikilink,
  setWindowTitle,
  takeLaunchPaths,
  writeText,
} from "@/lib/host"

type CloseChoice = "save" | "discard" | "cancel"
type Prompt = {
  title: string
  description: string
  allowDiscard: boolean
  settled: boolean
  resolve: (choice: CloseChoice) => void
}

const initialDocument = createDocument()

function imageAlt(src: string) {
  if (src.startsWith("data:")) return "Image"
  const name = fileTitle(src).replace(/\.[^.]+$/, "")
  return name || "Image"
}

export default function App() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([initialDocument])
  const [activeId, setActiveId] = useState(initialDocument.id)
  const [mode, setMode] = useState<"formatted" | "raw">("formatted")
  const [focus, setFocus] = useState(false)
  const [theme, setTheme] = useState<ThemeChoice>(loadTheme)
  const [recent, setRecent] = useState<string[]>(loadRecent)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState("Ready")
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkValue, setLinkValue] = useState("https://")
  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState("")
  const [findCursor, setFindCursor] = useState(0)
  const [findCount, setFindCount] = useState(0)
  const documentsRef = useRef(documents)
  const activeIdRef = useRef(activeId)
  const modeRef = useRef(mode)
  const editorRef = useRef<WriteEditorHandle>(null)
  const findInputRef = useRef<HTMLInputElement>(null)
  documentsRef.current = documents
  activeIdRef.current = activeId
  modeRef.current = mode

  const active = documents.find((document) => document.id === activeId) ?? documents[0]

  function replaceDocument(id: string, recipe: (document: DocumentRecord) => DocumentRecord) {
    const next = documentsRef.current.map((document) => (document.id === id ? recipe(document) : document))
    documentsRef.current = next
    setDocuments(next)
  }

  function ask(title: string, description: string, allowDiscard: boolean) {
    return new Promise<CloseChoice>((resolve) => {
      setPrompt({ title, description, allowDiscard, settled: false, resolve })
    })
  }

  function finishPrompt(choice: CloseChoice) {
    setPrompt((current) => {
      if (!current || current.settled) return null
      current.settled = true
      current.resolve(choice)
      return null
    })
  }

  async function saveDocument(id: string, saveAs = false) {
    const current = documentsRef.current.find((document) => document.id === id)
    if (!current) return false
    try {
      let path = saveAs ? null : current.path
      if (!path) {
        const chosen = await pickSave(current.path ?? "Untitled.md")
        if (!chosen) return false
        path = chosen
      }
      const latest = documentsRef.current.find((document) => document.id === id) ?? current
      await writeText(path, latest.draft)
      replaceDocument(id, (document) => ({ ...document, path, saved: document.draft }))
      if (!path.startsWith("/browser/")) setRecent((items) => rememberRecent(path, items))
      setStatus("Saved")
      setError(null)
      return true
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the file.")
      return false
    }
  }

  async function openPaths(paths: string[]) {
    let nextActive = activeIdRef.current
    const additions: DocumentRecord[] = []
    for (const path of paths) {
      const open = documentsRef.current.find((document) => document.path === path) ?? additions.find((document) => document.path === path)
      if (open) {
        nextActive = open.id
        continue
      }
      try {
        const text = await readText(path)
        const document = createDocument(path, text)
        additions.push(document)
        nextActive = document.id
        if (!path.startsWith("/browser/")) setRecent((items) => rememberRecent(path, items))
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not open that file.")
      }
    }
    if (additions.length) {
      setDocuments((current) => {
        const untouched = current.length === 1 && !current[0].path && current[0].draft === "" && current[0].saved === ""
        const next = untouched ? additions : [...current, ...additions]
        documentsRef.current = next
        return next
      })
      if (additions.some((document) => prefersRaw(document.draft))) setMode("raw")
    }
    setActiveId(nextActive)
    activeIdRef.current = nextActive
  }

  function newTab() {
    const document = createDocument()
    setDocuments((current) => {
      const next = [...current, document]
      documentsRef.current = next
      return next
    })
    setActiveId(document.id)
    activeIdRef.current = document.id
    setMode("formatted")
    setError(null)
  }

  function removeTab(id: string) {
    setDocuments((current) => {
      const next = current.filter((document) => document.id !== id)
      if (!next.length) {
        const fresh = createDocument()
        activeIdRef.current = fresh.id
        setActiveId(fresh.id)
        documentsRef.current = [fresh]
        return [fresh]
      }
      if (activeIdRef.current === id) {
        const index = current.findIndex((document) => document.id === id)
        const neighbor = next[Math.max(0, index - 1)]
        activeIdRef.current = neighbor.id
        setActiveId(neighbor.id)
      }
      documentsRef.current = next
      return next
    })
  }

  async function closeTab(id: string) {
    const document = documentsRef.current.find((item) => item.id === id)
    if (!document) return true
    if (isDirty(document)) {
      setActiveId(id)
      const choice = await ask("Save changes?", `${fileTitle(document.path)} has unsaved changes.`, true)
      if (choice === "cancel") return false
      if (choice === "save") {
        const saved = await saveDocument(id)
        if (!saved) return false
      }
    }
    removeTab(id)
    return true
  }

  async function attachSources(sources: string[]) {
    const id = activeIdRef.current
    let document = documentsRef.current.find((item) => item.id === id)
    if (!document || !sources.length) return
    if (!document.path) {
      const choice = await ask("Save this document", "Images are copied beside the saved file.", false)
      if (choice !== "save") return
      const saved = await saveDocument(id)
      if (!saved) return
      document = documentsRef.current.find((item) => item.id === id)
    }
    for (const source of sources) {
      try {
        const src = document?.path ? await importImage(document.path, source) : source
        editorRef.current?.insertImage(src, imageAlt(source))
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not attach that image.")
      }
    }
  }

  async function chooseImage() {
    const id = activeIdRef.current
    const document = documentsRef.current.find((item) => item.id === id)
    if (document && !document.path) {
      const choice = await ask("Save this document", "Images are copied beside the saved file.", false)
      if (choice !== "save") return
      const saved = await saveDocument(id)
      if (!saved) return
    }
    const source = await pickImage()
    if (source) await attachSources([source])
  }

  async function openLinked(target: string) {
    const document = documentsRef.current.find((item) => item.id === activeIdRef.current)
    if (!document?.path) {
      setError("Save the document before opening a linked note.")
      return
    }
    try {
      const resolved = await resolveWikilink(document.path, target)
      if (!resolved) {
        setError(`No file named ${target} beside this document.`)
        return
      }
      await openPaths([resolved])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open that linked note.")
    }
  }

  async function openFromPicker() {
    const selected = await pickOpen()
    if (selected?.length) await openPaths(selected)
  }

  editorBridge.documentPath = active?.path ?? null
  editorBridge.requestImage = () => {
    void chooseImage()
  }
  editorBridge.openWiki = (target) => {
    void openLinked(target)
  }

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches)
      document.documentElement.classList.toggle("dark", dark)
    }
    apply()
    saveTheme(theme)
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [theme])

  useEffect(() => {
    const title = `${active && isDirty(active) ? "• " : ""}${fileTitle(active?.path ?? null)} — Simple Write`
    void setWindowTitle(title)
  }, [active])

  useEffect(() => {
    void takeLaunchPaths().then((paths) => {
      if (paths.length) void openPaths(paths)
    })
    let dropUnlisten = () => {}
    let closeUnlisten = () => {}
    void listenForDrops((paths) => {
      const images = paths.filter(isImagePath)
      const files = paths.filter((path) => !isImagePath(path))
      if (files.length) void openPaths(files)
      if (images.length) void attachSources(images)
    }).then((unlisten) => {
      dropUnlisten = unlisten
    })
    void listenForClose(async () => {
      for (const document of documentsRef.current.filter(isDirty)) {
        setActiveId(document.id)
        const choice = await ask("Save changes?", `${fileTitle(document.path)} has unsaved changes.`, true)
        if (choice === "cancel") return false
        if (choice === "save") {
          const saved = await saveDocument(document.id)
          if (!saved) return false
        }
      }
      return true
    }).then((unlisten) => {
      closeUnlisten = unlisten
    })
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (documentsRef.current.some(isDirty)) {
        event.preventDefault()
        event.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => {
      dropUnlisten()
      closeUnlisten()
      window.removeEventListener("beforeunload", onBeforeUnload)
    }
    // Mount-only listeners keep the latest documents through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F1") {
        event.preventDefault()
        setShortcutsOpen(true)
        return
      }
      const mod = event.metaKey || event.ctrlKey
      if (!mod) return
      const key = event.key.toLowerCase()
      if (key === "n") {
        event.preventDefault()
        newTab()
      } else if (key === "o") {
        event.preventDefault()
        void openFromPicker()
      } else if (key === "s" && event.shiftKey) {
        event.preventDefault()
        void saveDocument(activeIdRef.current, true)
      } else if (key === "s") {
        event.preventDefault()
        void saveDocument(activeIdRef.current)
      } else if (key === "w") {
        event.preventDefault()
        void closeTab(activeIdRef.current)
      } else if (key === "f") {
        event.preventDefault()
        setFindOpen(true)
        setFindCursor(0)
        requestAnimationFrame(() => findInputRef.current?.focus())
      } else if (key === "m" && event.shiftKey) {
        event.preventDefault()
        setMode((current) => (current === "formatted" ? "raw" : "formatted"))
      } else if (key === "enter" && event.shiftKey) {
        event.preventDefault()
        setFocus((current) => !current)
      } else if (event.key === "Tab") {
        event.preventDefault()
        const items = documentsRef.current
        const index = items.findIndex((document) => document.id === activeIdRef.current)
        const next = items[(index + 1) % items.length]
        if (next) setActiveId(next.id)
      } else if (key === "k") {
        event.preventDefault()
        setLinkOpen(true)
      } else if ((key === "b" || key === "i") && modeRef.current === "raw") {
        event.preventDefault()
        editorRef.current?.wrap(key === "b" ? "**" : "*")
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
    // Keyboard actions read the latest documents through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onBrowserDrop(event: DragEvent) {
    if (isDesktop()) return
    event.preventDefault()
    const files = [...event.dataTransfer.files]
    const texts: string[] = []
    const images: string[] = []
    for (const file of files) {
      if (file.type.startsWith("image/")) images.push(await readBrowserImage(file))
      else texts.push(await rememberBrowserFile(file))
    }
    if (texts.length) await openPaths(texts)
    if (images.length) await attachSources(images)
  }

  return (
    <TooltipProvider>
      <div
        className="flex h-svh flex-col bg-background text-foreground"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => void onBrowserDrop(event)}
      >
        {focus ? (
          <div className="flex justify-end px-3 py-2">
            <Button variant="outline" size="sm" onClick={() => setFocus(false)}>
              Exit focus
            </Button>
          </div>
        ) : (
          <header className="border-b border-border">
            <div className="flex items-center gap-1 px-2 py-1.5" role="toolbar" aria-label="Document">
              <img src="/images/logo.png" alt="Simple Write" className="size-8 object-cover" />
              <Button variant="ghost" size="sm" onClick={newTab}>
                <FilePlusIcon data-icon="inline-start" />
                New
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void openFromPicker()}>
                <FolderOpenIcon data-icon="inline-start" />
                Open
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void saveDocument(active.id)}>
                <SaveIcon data-icon="inline-start" />
                Save
              </Button>
              <div className="ml-auto flex items-center gap-1">
                <ToggleGroup
                  aria-label="Editor mode"
                  variant="outline"
                  size="sm"
                  spacing={0}
                  value={[mode]}
                  onValueChange={(value) => {
                    const next = value.at(-1)
                    if (next === "formatted" || next === "raw") setMode(next)
                  }}
                >
                  <ToggleGroupItem value="formatted">Formatted</ToggleGroupItem>
                  <ToggleGroupItem value="raw">Markdown</ToggleGroupItem>
                </ToggleGroup>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-pressed={findOpen}
                  onClick={() => {
                    setFindOpen((open) => !open)
                    setFindCursor(0)
                    requestAnimationFrame(() => findInputRef.current?.focus())
                  }}
                >
                  Find
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="icon-sm" aria-label="More actions">
                        <EllipsisIcon />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => void saveDocument(active.id, true)}>Save As</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Recent files</DropdownMenuLabel>
                      {recent.length ? (
                        recent.map((path) => (
                          <DropdownMenuItem key={path} onClick={() => void openPaths([path])}>
                            {fileTitle(path)}
                          </DropdownMenuItem>
                        ))
                      ) : (
                        <DropdownMenuItem disabled>No recent files</DropdownMenuItem>
                      )}
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Theme</DropdownMenuLabel>
                      <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as ThemeChoice)}>
                        <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setFocus(true)}>Focus mode</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>Keyboard shortcuts</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {findOpen ? (
              <div className="flex items-center gap-2 px-2 pb-2">
                <Input
                  ref={findInputRef}
                  aria-label="Find"
                  value={findQuery}
                  onChange={(event) => {
                    setFindQuery(event.target.value)
                    setFindCursor(0)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      setFindCursor((cursor) => cursor + (event.shiftKey ? -1 : 1))
                    }
                    if (event.key === "Escape") setFindOpen(false)
                  }}
                />
                <span className="text-sm text-muted-foreground">{findCount}</span>
                <Button variant="ghost" size="sm" onClick={() => setFindCursor((cursor) => cursor - 1)}>
                  Previous
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setFindCursor((cursor) => cursor + 1)}>
                  Next
                </Button>
              </div>
            ) : null}
            <ScrollArea className="w-full">
              <div className="flex w-max items-center gap-1 px-2 pb-2" role="tablist" aria-label="Open documents">
                {documents.map((document) => {
                  const title = fileTitle(document.path)
                  const selected = document.id === active.id
                  return (
                    <div
                      key={document.id}
                      className={cn(
                        "inline-flex items-center rounded-lg",
                        selected ? "bg-secondary" : "hover:bg-muted",
                      )}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => setActiveId(document.id)}
                      >
                        {isDirty(document) ? "• " : ""}
                        {title}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="mr-0.5"
                        aria-label={`Close ${title}`}
                        onClick={() => void closeTab(document.id)}
                      >
                        <XIcon />
                      </Button>
                    </div>
                  )
                })}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </header>
        )}

        {error ? (
          <Alert variant="destructive" className="m-3">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <main className="min-h-0 flex-1 overflow-auto px-6 py-8">
          <div className="w-full">
            <WriteEditor
              key={active.id}
              ref={editorRef}
              draft={active.draft}
              mode={mode}
              find={{ open: findOpen, query: findQuery, cursor: findCursor }}
              onDraft={(draft) => replaceDocument(active.id, (document) => ({ ...document, draft }))}
              onFindCount={setFindCount}
            />
          </div>
        </main>

        {focus ? null : (
          <>
            <Separator />
            <footer className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground">
              <span className="min-w-0 flex-1 truncate">{active.path ?? "Not saved yet"}</span>
              <span aria-live="polite">{status === "Saved" && !isDirty(active) ? "Saved" : isDirty(active) ? "Unsaved changes" : "No changes"}</span>
              <span>{wordCount(active.draft)} words</span>
            </footer>
          </>
        )}

        <Dialog open={prompt !== null} onOpenChange={(open) => { if (!open) finishPrompt("cancel") }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{prompt?.title ?? "Save changes?"}</DialogTitle>
              <DialogDescription>{prompt?.description}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => finishPrompt("cancel")}>Cancel</Button>
              {prompt?.allowDiscard ? (
                <Button variant="destructive" onClick={() => finishPrompt("discard")}>Discard</Button>
              ) : null}
              <Button onClick={() => finishPrompt("save")}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a link</DialogTitle>
              <DialogDescription>The selected text becomes a link. Leave the address empty to remove it.</DialogDescription>
            </DialogHeader>
            <Input aria-label="Link address" value={linkValue} onChange={(event) => setLinkValue(event.target.value)} />
            <DialogFooter>
              <Button
                onClick={() => {
                  editorRef.current?.applyLink(linkValue.trim())
                  setLinkOpen(false)
                }}
              >
                Apply
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Keyboard shortcuts</DialogTitle>
              <DialogDescription>File commands follow the usual text editor keys.</DialogDescription>
            </DialogHeader>
            <ul className="flex flex-col gap-2 text-sm">
              <li>New: Ctrl+N</li>
              <li>Open: Ctrl+O</li>
              <li>Save: Ctrl+S</li>
              <li>Save As: Ctrl+Shift+S</li>
              <li>Close: Ctrl+W</li>
              <li>Find: Ctrl+F</li>
              <li>Next tab: Ctrl+Tab</li>
              <li>Markdown: Ctrl+Shift+M</li>
              <li>Focus mode: Ctrl+Shift+Enter</li>
              <li>Bold, italic, link: Ctrl+B, Ctrl+I, Ctrl+K</li>
              <li>Indent: Tab inserts four spaces. In a list, Tab nests the item.</li>
            </ul>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
