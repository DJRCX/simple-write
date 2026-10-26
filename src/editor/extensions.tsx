import { useEffect, useRef, useState } from "react"
import { ChevronDownIcon } from "lucide-react"
import { Extension, Node, mergeAttributes, type Editor, type Range } from "@tiptap/core"
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight"
import Heading from "@tiptap/extension-heading"
import Image from "@tiptap/extension-image"
import { Mathematics } from "@tiptap/extension-mathematics"
import Paragraph from "@tiptap/extension-paragraph"
import { Placeholder } from "@tiptap/extension-placeholder"
import TextAlign from "@tiptap/extension-text-align"
import { Table } from "@tiptap/extension-table"
import { TableCell } from "@tiptap/extension-table-cell"
import { TableHeader } from "@tiptap/extension-table-header"
import { TableRow } from "@tiptap/extension-table-row"
import { TaskItem } from "@tiptap/extension-task-item"
import { TaskList } from "@tiptap/extension-task-list"
import { Markdown } from "@tiptap/markdown"
import type { Node as ProseNode } from "@tiptap/pm/model"
import { NodeSelection, Plugin, PluginKey, TextSelection, type Selection } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, ReactRenderer, type ReactNodeViewProps } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Suggestion from "@tiptap/suggestion"
import { common, createLowlight } from "lowlight"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { editorBridge } from "@/editor/bridge"
import { SlashList, type SlashItem, type SlashListHandle } from "@/editor/slash-list"
import { imageDataUrl } from "@/lib/host"

const lowlight = createLowlight(common)

function ImageView(props: ReactNodeViewProps) {
  const src = String(props.node.attrs.src ?? "")
  const alt = String(props.node.attrs.alt ?? "Image")
  const [url, setUrl] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    setMissing(false)
    void imageDataUrl(editorBridge.documentPath, src)
      .then((value) => {
        if (cancelled) return
        setUrl(value)
        setMissing(!value)
      })
      .catch(() => {
        if (!cancelled) setMissing(true)
      })
    return () => {
      cancelled = true
    }
  }, [src])

  const align = props.node.attrs.textAlign === "center" || props.node.attrs.textAlign === "right" ? props.node.attrs.textAlign : "left"
  return (
    <NodeViewWrapper className="my-3" style={{ textAlign: align }}>
      {url && !missing ? (
        <img src={url} alt={alt} className={align === "center" ? "mx-auto" : align === "right" ? "ml-auto" : undefined} />
      ) : (
        <span className="text-sm text-muted-foreground">{missing ? `Missing image: ${alt}` : alt}</span>
      )}
    </NodeViewWrapper>
  )
}

function WikiView(props: ReactNodeViewProps) {
  const target = String(props.node.attrs.target ?? "")

  if (props.selected) {
    return (
      <NodeViewWrapper as="span" className="inline-flex">
        <Input
          aria-label="Linked note"
          value={target}
          className="h-7 w-40"
          onChange={(event) => props.updateAttributes({ target: event.target.value })}
        />
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper as="span">
      <button
        type="button"
        className="text-primary underline-offset-4 hover:underline"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editorBridge.openWiki(target)}
      >
        {target || "Linked note"}
      </button>
    </NodeViewWrapper>
  )
}

const codeLanguages = [
  ["plaintext", "Plain text"],
  ["mermaid", "Mermaid"],
  ["arduino", "Arduino"],
  ["bash", "Bash"],
  ["c", "C"],
  ["cpp", "C++"],
  ["csharp", "C#"],
  ["css", "CSS"],
  ["diff", "Diff"],
  ["go", "Go"],
  ["graphql", "GraphQL"],
  ["ini", "INI"],
  ["java", "Java"],
  ["javascript", "JavaScript"],
  ["json", "JSON"],
  ["kotlin", "Kotlin"],
  ["less", "Less"],
  ["lua", "Lua"],
  ["makefile", "Makefile"],
  ["markdown", "Markdown"],
  ["objectivec", "Objective-C"],
  ["perl", "Perl"],
  ["php", "PHP"],
  ["python", "Python"],
  ["r", "R"],
  ["ruby", "Ruby"],
  ["rust", "Rust"],
  ["scss", "SCSS"],
  ["shell", "Shell"],
  ["sql", "SQL"],
  ["swift", "Swift"],
  ["typescript", "TypeScript"],
  ["vbnet", "VB.NET"],
  ["wasm", "WebAssembly"],
  ["xml", "HTML / XML"],
] as const

const mermaidSample = "flowchart TD\n  A[Start] --> B[Next]"

type DiagramView = "code" | "diagram" | "both"

function CodeBlockView(props: ReactNodeViewProps) {
  const language = String(props.node.attrs.language ?? "plaintext")
  const source = props.node.textContent
  const isMermaid = language === "mermaid"
  const [display, setDisplay] = useState<DiagramView>("diagram")
  const [error, setError] = useState<string | null>(null)
  const container = useRef<HTMLDivElement>(null)
  const showCode = !isMermaid || display !== "diagram" || error !== null
  const languageLabel = codeLanguages.find(([id]) => id === language)?.[1] ?? language

  useEffect(() => {
    if (!isMermaid || display === "code" || !source.trim()) return
    let cancelled = false
    const target = container.current
    void import("mermaid").then(async ({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "antiscript",
        suppressErrorRendering: true,
        theme: document.documentElement.classList.contains("dark") ? "dark" : "neutral",
      })
      const id = `m${crypto.randomUUID().replace(/-/g, "")}`
      try {
        const rendered = await mermaid.render(id, source)
        if (cancelled || !target) return
        target.innerHTML = rendered.svg
        setError(null)
      } catch (caught) {
        if (target) target.replaceChildren()
        document.getElementById(id)?.remove()
        if (!cancelled) setError(caught instanceof Error ? caught.message : "This diagram could not be drawn.")
      }
    })
    return () => {
      cancelled = true
    }
  }, [display, isMermaid, source])

  const blockAlign = props.node.attrs.textAlign === "center" || props.node.attrs.textAlign === "right" ? props.node.attrs.textAlign : undefined
  return (
    <NodeViewWrapper className="my-3" style={blockAlign ? { textAlign: blockAlign } : undefined}>
      <div
        className="mb-2 flex flex-wrap items-center gap-2"
        onMouseDown={(event) => {
          if ((event.target as HTMLElement).closest("button")) return
          event.preventDefault()
        }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" tabIndex={-1} aria-label="Code language">
                {languageLabel}
                <ChevronDownIcon data-icon="inline-end" />
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
            <DropdownMenuRadioGroup value={language} onValueChange={(value) => props.updateAttributes({ language: value })}>
              {codeLanguages.map(([id, label]) => (
                <DropdownMenuRadioItem key={id} value={id}>
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {isMermaid ? (
          <ToggleGroup
            aria-label="Mermaid display"
            variant="outline"
            size="sm"
            spacing={0}
            value={[display]}
            onValueChange={(value) => {
              const next = value.at(-1)
              if (next === "code" || next === "diagram" || next === "both") setDisplay(next)
            }}
          >
            <ToggleGroupItem value="code" tabIndex={-1}>Code</ToggleGroupItem>
            <ToggleGroupItem value="diagram" tabIndex={-1}>Diagram</ToggleGroupItem>
            <ToggleGroupItem value="both" tabIndex={-1}>Both</ToggleGroupItem>
          </ToggleGroup>
        ) : null}
      </div>
      {isMermaid && display !== "code" ? (
        <div className="overflow-x-auto">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div ref={container} className={error ? "hidden" : undefined} />
        </div>
      ) : null}
      <div
        className={showCode ? "overflow-x-auto rounded-lg bg-muted px-4 py-3" : "sr-only"}
        onMouseDown={(event) => {
          if (event.target !== event.currentTarget) return
          const position = props.getPos()
          if (typeof position !== "number") return
          event.preventDefault()
          props.editor.chain().focus().setTextSelection(position + 1).run()
        }}
      >
        <NodeViewContent />
      </div>
    </NodeViewWrapper>
  )
}

const DocumentImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageView)
  },
  renderMarkdown(node) {
    const src = String(node.attrs?.src ?? "")
    const alt = String(node.attrs?.alt ?? "")
    const title = node.attrs?.title ? ` "${String(node.attrs.title)}"` : ""
    const destination = /[\s()]/.test(src) ? `<${src}>` : src
    const markdown = `![${alt}](${destination}${title})`
    const align = node.attrs?.textAlign
    if (align !== "center" && align !== "right") return markdown
    return `<img src="${src}" alt="${alt}" style="text-align: ${align}">`
  },
}).configure({ allowBase64: true })

const LinkedNote = Node.create({
  name: "wikilink",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { target: { default: "" } }
  },
  parseHTML() {
    return [{ tag: "span[data-wikilink]" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-wikilink": "" }), HTMLAttributes.target ?? ""]
  },
  addNodeView() {
    return ReactNodeViewRenderer(WikiView)
  },
  markdownTokenName: "wikilink",
  markdownTokenizer: {
    name: "wikilink",
    level: "inline",
    start: (src) => src.indexOf("[["),
    tokenize(src) {
      const match = /^\[\[([^\]\n]+)\]\]/.exec(src)
      if (!match) return undefined
      return { type: "wikilink", raw: match[0], target: match[1] }
    },
  },
  parseMarkdown(token) {
    const target = "target" in token ? String(token.target ?? "") : ""
    return { type: "wikilink", attrs: { target } }
  },
  renderMarkdown(node) {
    return `[[${String(node.attrs?.target ?? "")}]]`
  },
})

function alignedMarkdown(body: string, align: unknown, tag: "p" | "h1" | "h2" | "h3" | "h4") {
  if ((align !== "center" && align !== "right") || !body.trim()) return body
  return `<${tag} data-align="${align}">${body}</${tag}>`
}

const AlignedParagraph = Paragraph.extend({
  renderMarkdown(node, helpers, context) {
    const base = this.parent?.(node, helpers, context) ?? ""
    return alignedMarkdown(String(base), node.attrs?.textAlign, "p")
  },
})

const AlignedHeading = Heading.extend({
  renderMarkdown(node, helpers, context) {
    const base = this.parent?.(node, helpers, context) ?? ""
    const level = Number(node.attrs?.level ?? 1)
    const tag = `h${level >= 1 && level <= 4 ? level : 1}` as "h1" | "h2" | "h3" | "h4"
    return alignedMarkdown(String(base), node.attrs?.textAlign, tag)
  },
})

const AlignedBlock = Extension.create({
  name: "alignedBlock",
  markdownTokenizer: {
    name: "alignedBlock",
    level: "block",
    start: (src) => {
      const paragraph = src.indexOf("<p data-align=")
      const heading = src.search(/<h[1-4] data-align=/)
      if (paragraph < 0) return heading
      if (heading < 0) return paragraph
      return Math.min(paragraph, heading)
    },
    tokenize(src) {
      const paragraph = /^<p data-align="(center|right)">([\s\S]*?)<\/p>/.exec(src)
      if (paragraph) {
        return { type: "alignedBlock", raw: paragraph[0], align: paragraph[1], kind: "paragraph", text: paragraph[2] }
      }
      const heading = /^<h([1-4]) data-align="(center|right)">([\s\S]*?)<\/h\1>/.exec(src)
      if (!heading) return undefined
      return {
        type: "alignedBlock",
        raw: heading[0],
        align: heading[2],
        kind: "heading",
        level: Number(heading[1]),
        text: heading[3],
      }
    },
  },
  parseMarkdown(token, helpers) {
    const align = token.align === "right" ? "right" : "center"
    const text = "text" in token ? String(token.text ?? "") : ""
    const content = helpers.parseInline(helpers.tokenizeInline?.(text) ?? [])
    if (token.kind === "heading") {
      const level = Number(token.level ?? 1)
      return helpers.createNode("heading", { level, textAlign: align }, content)
    }
    return helpers.createNode("paragraph", { textAlign: align }, content)
  },
})

function inList(editor: Editor) {
  return editor.isActive("listItem") || editor.isActive("taskItem")
}

const indent = "    "

const TabSpaces = Extension.create({
  name: "tabSpaces",
  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        if (inList(editor)) return false
        return editor.commands.insertContent(indent)
      },
      "Shift-Tab": ({ editor }) => {
        if (inList(editor)) return false
        const { from, empty } = editor.state.selection
        if (!empty) return true
        const before = editor.state.doc.textBetween(Math.max(0, from - indent.length), from, "\n", "\n")
        const spaces = before.match(/ *$/)?.[0].length ?? 0
        if (!spaces) return true
        return editor.commands.deleteRange({ from: from - spaces, to: from })
      },
    }
  },
})

const blockUnits = new Set([
  "heading",
  "listItem",
  "taskItem",
  "codeBlock",
  "image",
  "blockquote",
  "horizontalRule",
  "table",
])

function isBlockUnit(node: ProseNode, parent: ProseNode | null) {
  if (node.type.name === "paragraph") {
    const parentName = parent?.type.name
    return parentName !== "listItem" && parentName !== "taskItem" && parentName !== "blockquote" && parentName !== "tableCell" && parentName !== "tableHeader"
  }
  return blockUnits.has(node.type.name)
}

function blocksBetween(doc: ProseNode, from: number, to: number) {
  const blocks: { pos: number; node: ProseNode }[] = []
  const end = Math.max(from, to)
  doc.nodesBetween(Math.min(from, end), end, (node, pos, parent) => {
    if (!isBlockUnit(node, parent)) return
    blocks.push({ pos, node })
    return false
  })
  return blocks
}

function selectBlockContent(doc: ProseNode, pos: number, node: ProseNode): Selection | null {
  const end = pos + node.nodeSize
  if (node.isAtom) return NodeSelection.create(doc, pos)
  const content = TextSelection.between(doc.resolve(pos), doc.resolve(end))
  if (!content.empty && content.from >= pos && content.to <= end) return content
  return NodeSelection.create(doc, pos)
}

function blockAt(doc: ProseNode, pos: number) {
  const probe = Math.min(Math.max(pos, 1), Math.max(doc.content.size, 1))
  return blocksBetween(doc, probe, probe).at(-1) ?? blocksBetween(doc, Math.max(0, probe - 1), probe).at(-1) ?? null
}

function selectionCovers(selection: Selection, target: Selection) {
  return selection.from <= target.from && selection.to >= target.to
}

function expandedAcrossBlocks(doc: ProseNode, selection: Selection) {
  if (!(selection instanceof TextSelection) || selection.empty) return null
  const blocks = blocksBetween(doc, selection.from, selection.to)
  if (blocks.length < 2) return null
  const first = blocks[0]
  const last = blocks[blocks.length - 1]
  const next = TextSelection.between(doc.resolve(first.pos), doc.resolve(last.pos + last.node.nodeSize))
  if (next.from === selection.from && next.to === selection.to) return null
  return next
}

const BlockSelection = Extension.create({
  name: "blockSelection",
  addKeyboardShortcuts() {
    return {
      "Mod-a": ({ editor }) => {
        const { state, view } = editor
        const { doc, selection } = state
        const block = blockAt(doc, selection.from)
        const content = block ? selectBlockContent(doc, block.pos, block.node) : null
        const selectDocument =
          !content ||
          selection.from < content.from ||
          selection.to > content.to ||
          (selection.from === content.from && selection.to === content.to)
        const next =
          selectDocument || !content
            ? TextSelection.between(doc.resolve(0), doc.resolve(doc.content.size))
            : content
        view.dispatch(state.tr.setSelection(next))
        return true
      },
    }
  },
  addProseMirrorPlugins() {
    let dragging = false
    return [
      new Plugin({
        props: {
          decorations(state) {
            const { selection, doc } = state
            if (selection.empty) return DecorationSet.empty
            if (selection instanceof NodeSelection) {
              const node = doc.nodeAt(selection.from)
              if (!node) return DecorationSet.empty
              return DecorationSet.create(doc, [Decoration.node(selection.from, selection.to, { class: "block-selected" })])
            }
            if (!(selection instanceof TextSelection)) return DecorationSet.empty
            const blocks = blocksBetween(doc, selection.from, selection.to)
            if (!blocks.length) return DecorationSet.empty
            if (blocks.length === 1) {
              const only = blocks[0]
              const content = selectBlockContent(doc, only.pos, only.node)
              if (!content || !selectionCovers(selection, content)) return DecorationSet.empty
            }
            return DecorationSet.create(
              doc,
              blocks.map(({ pos, node }) => Decoration.node(pos, pos + node.nodeSize, { class: "block-selected" })),
            )
          },
          handleDOMEvents: {
            mousedown() {
              dragging = true
              return false
            },
            mouseup(_view, event) {
              dragging = false
              if (event.button !== 0) return false
              const next = expandedAcrossBlocks(_view.state.doc, _view.state.selection)
              if (!next) return false
              _view.dispatch(_view.state.tr.setSelection(next).setMeta("blockSelection", true))
              return false
            },
          },
        },
        appendTransaction(transactions, _old, state) {
          if (dragging) return null
          if (!transactions.some((transaction) => transaction.selectionSet && !transaction.getMeta("blockSelection"))) return null
          const next = expandedAcrossBlocks(state.doc, state.selection)
          if (!next) return null
          return state.tr.setSelection(next).setMeta("blockSelection", true)
        },
      }),
    ]
  },
})

type SlashDefinition = {
  id: string
  label: string
  keywords: string
  run: (editor: Editor, range: Range) => void
}

function afterSlash(editor: Editor, range: Range) {
  return editor.chain().focus().deleteRange(range)
}

const slashDefinitions: SlashDefinition[] = [
  { id: "text", label: "Text", keywords: "paragraph", run: (editor, range) => afterSlash(editor, range).setParagraph().run() },
  { id: "h1", label: "Heading 1", keywords: "title", run: (editor, range) => afterSlash(editor, range).setHeading({ level: 1 }).run() },
  { id: "h2", label: "Heading 2", keywords: "title", run: (editor, range) => afterSlash(editor, range).setHeading({ level: 2 }).run() },
  { id: "h3", label: "Heading 3", keywords: "title", run: (editor, range) => afterSlash(editor, range).setHeading({ level: 3 }).run() },
  { id: "h4", label: "Heading 4", keywords: "title", run: (editor, range) => afterSlash(editor, range).setHeading({ level: 4 }).run() },
  { id: "bullet", label: "Bullet list", keywords: "ul", run: (editor, range) => afterSlash(editor, range).toggleBulletList().run() },
  { id: "numbered", label: "Numbered list", keywords: "ol", run: (editor, range) => afterSlash(editor, range).toggleOrderedList().run() },
  { id: "task", label: "Task list", keywords: "todo checkbox", run: (editor, range) => afterSlash(editor, range).toggleTaskList().run() },
  { id: "quote", label: "Quote", keywords: "blockquote", run: (editor, range) => afterSlash(editor, range).toggleBlockquote().run() },
  { id: "code", label: "Code block", keywords: "fence", run: (editor, range) => afterSlash(editor, range).setCodeBlock().run() },
  {
    id: "mermaid",
    label: "Mermaid",
    keywords: "diagram graph",
    run: (editor, range) =>
      afterSlash(editor, range)
        .insertContent({
          type: "codeBlock",
          attrs: { language: "mermaid" },
          content: [{ type: "text", text: mermaidSample }],
        })
        .run(),
  },
  {
    id: "math",
    label: "Block math",
    keywords: "latex katex",
    run: (editor, range) => afterSlash(editor, range).insertBlockMath({ latex: "E = mc^2" }).run(),
  },
  { id: "divider", label: "Divider", keywords: "hr rule", run: (editor, range) => afterSlash(editor, range).setHorizontalRule().run() },
  {
    id: "image",
    label: "Image",
    keywords: "picture photo",
    run: (editor, range) => {
      afterSlash(editor, range).run()
      editorBridge.requestImage()
    },
  },
  {
    id: "table",
    label: "Table",
    keywords: "grid",
    run: (editor, range) => afterSlash(editor, range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: "wikilink",
    label: "Wikilink",
    keywords: "note link",
    run: (editor, range) => afterSlash(editor, range).insertContent({ type: "wikilink", attrs: { target: "note" } }).run(),
  },
]

export const insertMenu = slashDefinitions.map(({ id, label }) => ({ id, label }))

export function runInsert(editor: Editor, id: string) {
  const item = slashDefinitions.find((entry) => entry.id === id)
  if (!item) return
  const position = editor.state.selection.from
  item.run(editor, { from: position, to: position })
}

function placeSlashMenu(element: HTMLElement, clientRect?: (() => DOMRect | null) | null) {
  const rect = clientRect?.()
  element.style.position = "fixed"
  element.style.zIndex = "50"
  if (!rect) return
  element.style.left = `${rect.left}px`
  element.style.top = `${rect.bottom + 6}px`
}

const SlashCommands = Extension.create({
  name: "slashCommands",
  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        char: "/",
        startOfLine: true,
        allowSpaces: false,
        pluginKey: new PluginKey("slashCommands"),
        items: ({ query }) =>
          slashDefinitions
            .filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(query.toLowerCase()))
            .map((item) => ({ ...item, apply: () => {} })),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => {
          let renderer: ReactRenderer<SlashListHandle> | null = null
          return {
            onStart: (props) => {
              renderer = new ReactRenderer(SlashList, { props, editor: props.editor })
              placeSlashMenu(renderer.element, props.clientRect)
              document.body.appendChild(renderer.element)
            },
            onUpdate: (props) => {
              renderer?.updateProps(props)
              if (renderer) placeSlashMenu(renderer.element, props.clientRect)
            },
            onKeyDown: (props) => renderer?.ref?.onKeyDown(props) ?? false,
            onExit: () => {
              renderer?.destroy()
              renderer?.element.remove()
              renderer = null
            },
          }
        },
      }),
    ]
  },
})

export const extensions = [
  Markdown,
  StarterKit.configure({
    codeBlock: false,
    heading: false,
    paragraph: false,
    link: { openOnClick: false },
  }),
  AlignedParagraph,
  AlignedHeading.configure({ levels: [1, 2, 3, 4] }),
  AlignedBlock,
  TextAlign.configure({
    types: ["heading", "paragraph", "image", "codeBlock"],
    alignments: ["left", "center", "right"],
    defaultAlignment: "left",
  }),
  Placeholder.configure({ placeholder: "Start writing, or type / for blocks" }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  CodeBlockLowlight.extend({
    addNodeView() {
      return ReactNodeViewRenderer(CodeBlockView)
    },
  }).configure({ lowlight }),
  Mathematics.configure({ katexOptions: { throwOnError: false } }),
  DocumentImage,
  LinkedNote,
  TabSpaces,
  BlockSelection,
  SlashCommands,
]
