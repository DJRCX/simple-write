import { useState } from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import { Markdown } from "@tiptap/markdown"
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  ListTodo,
  Heading2,
} from "lucide-react"
import { cn } from "@/lib/utils"

const SAMPLE = `# Notes

Open a file from anywhere. Each tab is one document.

- Write on a **formatted** page
- Switch to Markdown for the source

- [ ] Draft something
- [x] Keep it as \`.md\`
`

export function Playground() {
  const [mode, setMode] = useState<"formatted" | "raw">("formatted")
  const [raw, setRaw] = useState(SAMPLE)
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Start writing…" }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Markdown,
    ],
    content: SAMPLE,
    contentType: "markdown",
    editorProps: {
      attributes: {
        class: "playground-doc",
        "aria-label": "Simple Write playground",
      },
    },
    onUpdate: ({ editor: current }) => {
      setRaw(current.getMarkdown())
    },
  })

  function setModeSafe(next: "formatted" | "raw") {
    if (!editor || next === mode) return
    if (next === "raw") {
      setRaw(editor.getMarkdown())
    } else {
      editor.commands.setContent(raw, { contentType: "markdown", emitUpdate: false })
    }
    setMode(next)
  }

  function run(command: () => boolean) {
    if (!editor || mode !== "formatted") return
    command()
    editor.chain().focus().run()
  }

  return (
    <div className="app-window" role="region" aria-label="Live app preview">
      <div className="app-titlebar">
        <div className="app-traffic" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="app-title">
          <img src="/images/logo.png" alt="" width={16} height={16} />
          <span>notes.md — Simple Write</span>
        </div>
        <div className="app-title-spacer" aria-hidden="true" />
      </div>

      <div className="app-toolbar">
        <div className="app-tabs">
          <button type="button" className="app-tab active">
            notes.md
            <span className="app-dot" aria-hidden="true" />
          </button>
          <button type="button" className="app-tab ghost" disabled>
            Untitled
          </button>
        </div>
        <div className="app-mode" role="group" aria-label="Editor mode">
          <button
            type="button"
            className={cn(mode === "formatted" && "active")}
            onClick={() => setModeSafe("formatted")}
          >
            Formatted
          </button>
          <button
            type="button"
            className={cn(mode === "raw" && "active")}
            onClick={() => setModeSafe("raw")}
          >
            Markdown
          </button>
        </div>
      </div>

      {mode === "formatted" ? (
        <div className="app-format-bar">
          <button
            type="button"
            aria-label="Bold"
            onClick={() => run(() => editor!.chain().focus().toggleBold().run())}
          >
            <Bold size={15} />
          </button>
          <button
            type="button"
            aria-label="Italic"
            onClick={() => run(() => editor!.chain().focus().toggleItalic().run())}
          >
            <Italic size={15} />
          </button>
          <button
            type="button"
            aria-label="Heading"
            onClick={() =>
              run(() => editor!.chain().focus().toggleHeading({ level: 2 }).run())
            }
          >
            <Heading2 size={15} />
          </button>
          <button
            type="button"
            aria-label="Bullet list"
            onClick={() => run(() => editor!.chain().focus().toggleBulletList().run())}
          >
            <List size={15} />
          </button>
          <button
            type="button"
            aria-label="Numbered list"
            onClick={() => run(() => editor!.chain().focus().toggleOrderedList().run())}
          >
            <ListOrdered size={15} />
          </button>
          <button
            type="button"
            aria-label="Task list"
            onClick={() => run(() => editor!.chain().focus().toggleTaskList().run())}
          >
            <ListTodo size={15} />
          </button>
        </div>
      ) : null}

      <div className="app-body">
        {mode === "formatted" ? (
          <EditorContent editor={editor} />
        ) : (
          <textarea
            className="playground-raw"
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            spellCheck={false}
            aria-label="Raw Markdown"
          />
        )}
      </div>

    </div>
  )
}
