import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import { BlockAlign } from "@/editor/block-align"
import { extensions, runInsert } from "@/editor/extensions"
import { findMatches, markdownImage } from "@/lib/documents"
import { Textarea } from "@/components/ui/textarea"

export type WriteEditorHandle = {
  insertImage: (src: string, alt: string) => void
  applyLink: (href: string) => void
  wrap: (marker: string) => void
  insertBlock: (id: string) => void
  toggleMark: (mark: "bold" | "italic") => void
}

type WriteEditorProps = {
  draft: string
  mode: "formatted" | "raw"
  find: { open: boolean; query: string; cursor: number }
  onDraft: (draft: string) => void
  onFindCount: (count: number) => void
}

function textPositions(editor: Editor, query: string) {
  const positions: number[] = []
  const needle = query.toLowerCase()
  if (!needle) return positions
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    const text = node.text.toLowerCase()
    let index = 0
    while (index <= text.length - needle.length) {
      const found = text.indexOf(needle, index)
      if (found === -1) break
      positions.push(pos + found)
      index = found + needle.length
    }
  })
  return positions
}

export const WriteEditor = forwardRef<WriteEditorHandle, WriteEditorProps>(function WriteEditor(
  { draft, mode, find, onDraft, onFindCount },
  ref,
) {
  const emitted = useRef(draft)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const editor = useEditor({
    extensions,
    content: draft,
    contentType: "markdown",
    editorProps: {
      attributes: {
        "aria-label": "Document",
        class: "min-h-[70vh]",
      },
    },
    onUpdate: ({ editor: current, transaction }) => {
      if (!transaction.docChanged) return
      const markdown = current.getMarkdown()
      emitted.current = markdown
      onDraft(markdown)
    },
  })

  useEffect(() => {
    if (!editor || mode !== "formatted") return
    if (draft === emitted.current) return
    editor.commands.setContent(draft, { contentType: "markdown", emitUpdate: false })
    emitted.current = draft
  }, [draft, editor, mode])

  useEffect(() => {
    if (!find.open || !find.query) {
      onFindCount(0)
      return
    }
    if (mode === "raw") {
      onFindCount(findMatches(draft, find.query).length)
      return
    }
    if (!editor) return
    onFindCount(textPositions(editor, find.query).length)
  }, [draft, editor, find.open, find.query, mode, onFindCount])

  useEffect(() => {
    if (!find.open || !find.query) return
    if (mode === "raw") {
      const area = textareaRef.current
      if (!area) return
      const matches = findMatches(area.value, find.query)
      if (!matches.length) return
      const index = ((find.cursor % matches.length) + matches.length) % matches.length
      const start = matches[index]
      area.focus()
      area.setSelectionRange(start, start + find.query.length)
      return
    }
    if (!editor) return
    const positions = textPositions(editor, find.query)
    if (!positions.length) return
    const index = ((find.cursor % positions.length) + positions.length) % positions.length
    const from = positions[index]
    editor.chain().focus().setTextSelection({ from, to: from + find.query.length }).scrollIntoView().run()
  }, [editor, find.cursor, find.open, find.query, mode])

  useImperativeHandle(ref, () => ({
    insertImage: (src, alt) => {
      const snippet = markdownImage(alt, src)
      if (mode === "raw" || !editor) {
        const prefix = draft.endsWith("\n") || draft.length === 0 ? "" : "\n"
        const next = `${draft}${prefix}${snippet}\n`
        emitted.current = next
        onDraft(next)
        return
      }
      editor.chain().focus().insertContent({ type: "image", attrs: { src, alt } }).run()
    },
    applyLink: (href) => {
      if (mode === "raw" || !editor) {
        const area = textareaRef.current
        const start = area?.selectionStart ?? draft.length
        const end = area?.selectionEnd ?? draft.length
        const selected = draft.slice(start, end) || href
        const next = `${draft.slice(0, start)}[${selected}](${href})${draft.slice(end)}`
        emitted.current = next
        onDraft(next)
        return
      }
      const { from, to } = editor.state.selection
      if (!href) {
        editor.chain().focus().unsetLink().run()
        return
      }
      if (from === to) {
        editor.chain().focus().insertContent(href).setTextSelection({ from, to: from + href.length }).setLink({ href }).run()
        return
      }
      editor.chain().focus().setLink({ href }).run()
    },
    wrap: (marker) => {
      const area = textareaRef.current
      const start = area?.selectionStart ?? draft.length
      const end = area?.selectionEnd ?? draft.length
      const selected = draft.slice(start, end) || "text"
      const next = `${draft.slice(0, start)}${marker}${selected}${marker}${draft.slice(end)}`
      emitted.current = next
      onDraft(next)
    },
    insertBlock: (id) => {
      if (mode === "raw" || !editor) return
      runInsert(editor, id)
    },
    toggleMark: (mark) => {
      if (mode === "raw" || !editor) {
        const marker = mark === "bold" ? "**" : "*"
        const area = textareaRef.current
        const start = area?.selectionStart ?? draft.length
        const end = area?.selectionEnd ?? draft.length
        const selected = draft.slice(start, end) || "text"
        const next = `${draft.slice(0, start)}${marker}${selected}${marker}${draft.slice(end)}`
        emitted.current = next
        onDraft(next)
        return
      }
      const chain = editor.chain().focus()
      if (mark === "bold") chain.toggleBold().run()
      else chain.toggleItalic().run()
    },
  }))

  if (mode === "raw") {
    return (
      <Textarea
        ref={textareaRef}
        aria-label="Markdown source"
        value={draft}
        className="markdown-source min-h-[70vh]"
        onChange={(event) => onDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return
          event.preventDefault()
          const area = event.currentTarget
          const start = area.selectionStart
          const end = area.selectionEnd
          const value = area.value
          if (event.shiftKey) {
            const lineStart = value.lastIndexOf("\n", start - 1) + 1
            const removable = value.slice(lineStart, start).match(/ {1,4}$/)?.[0].length ?? 0
            if (!removable) return
            const next = `${value.slice(0, start - removable)}${value.slice(end)}`
            onDraft(next)
            requestAnimationFrame(() => {
              area.selectionStart = start - removable
              area.selectionEnd = Math.max(start - removable, end - removable)
            })
            return
          }
          const next = `${value.slice(0, start)}    ${value.slice(end)}`
          onDraft(next)
          requestAnimationFrame(() => {
            area.selectionStart = start + 4
            area.selectionEnd = end + 4
          })
        }}
      />
    )
  }

  return (
    <div ref={(node) => { hostRef.current = node; setHost(node) }} className="relative pl-16">
      {editor ? <BlockAlign editor={editor} host={host} /> : null}
      <EditorContent editor={editor} />
    </div>
  )
})
