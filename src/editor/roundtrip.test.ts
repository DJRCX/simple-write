import { Editor } from "@tiptap/react"
import { TextSelection } from "@tiptap/pm/state"
import { describe, expect, it } from "vitest"
import { extensions } from "@/editor/extensions"
import { isDirty, markdownImage, prefersRaw } from "@/lib/documents"

const fixture = `# Title

## Section

A paragraph with **bold** and *italic*.

- one
- two

1. first
2. second

- [ ] open
- [x] done

> quoted

\`\`\`ts
const answer = 42
\`\`\`

\`\`\`mermaid
graph TD
  A[Start] --> B[Next]
\`\`\`

$$
E = mc^2
$$

Inline math $a^2 + b^2 = c^2$ beside text.

![Diagram](plot.png)

![Photo](<my photo.png>)

See [[sibling]] for the rest.

| Name | Value |
| --- | --- |
| A | 1 |
`

function editorFor(content: string) {
  const element = document.createElement("div")
  document.body.appendChild(element)
  return new Editor({
    element,
    extensions,
    content,
    contentType: "markdown",
  })
}

describe("markdown round trip", () => {
  it("keeps a second pass stable and preserves the supported constructs", () => {
    const editor = editorFor(fixture)
    const first = editor.getMarkdown()
    editor.commands.setContent(first, { contentType: "markdown", emitUpdate: false })
    const second = editor.getMarkdown()
    editor.commands.setContent(second, { contentType: "markdown", emitUpdate: false })
    const third = editor.getMarkdown()
    editor.destroy()

    expect(third).toBe(second)
    expect(second).toContain("# Title")
    expect(second).toContain("## Section")
    expect(second).toContain("- one")
    expect(second).toContain("1. first")
    expect(second).toContain("- [ ] open")
    expect(second).toContain("- [x] done")
    expect(second).toContain("> quoted")
    expect(second).toContain("```ts")
    expect(second).toContain("```mermaid")
    expect(second).toContain("$$")
    expect(second).toContain("$a^2 + b^2 = c^2$")
    expect(second).toContain("![Diagram](plot.png)")
    expect(second).toContain("![Photo](<my photo.png>)")
    expect(second).toContain("[[sibling]]")
    expect(second).toContain("| Name | Value |")
  })

  it("keeps centered text and headings through a markdown round trip", () => {
    const editor = editorFor("Centered line\n\n# Centered title")
    editor.chain().setTextSelection(2).setTextAlign("center").run()
    editor.chain().setTextSelection(20).setTextAlign("center").run()
    const markdown = editor.getMarkdown()
    editor.commands.setContent(markdown, { contentType: "markdown", emitUpdate: false })
    const paragraph = editor.state.doc.firstChild
    const heading = editor.state.doc.child(1)
    editor.destroy()
    expect(paragraph?.attrs.textAlign).toBe("center")
    expect(heading?.attrs.textAlign).toBe("center")
  })

  it("does not mark a freshly opened document dirty", () => {
    expect(isDirty({ saved: fixture, draft: fixture })).toBe(false)
    expect(isDirty({ saved: fixture, draft: `${fixture}\n` })).toBe(true)
  })

  it("keeps spaced image names in angle brackets", () => {
    expect(markdownImage("Photo", "my photo.png")).toBe("![Photo](<my photo.png>)")
  })

  it("inserts four spaces with tab and selects headings and paragraphs as separate blocks", () => {
    const editor = editorFor("# Title\n\nHello there")
    editor.commands.setTextSelection(1)
    editor.commands.keyboardShortcut("Tab")
    expect(editor.state.doc.firstChild?.textContent).toBe("    Title")

    const selectAll = new KeyboardEvent("keydown", { key: "a", ctrlKey: true, bubbles: true, cancelable: true })
    editor.view.someProp("handleKeyDown", (handler) => handler(editor.view, selectAll))
    const heading = editor.state.doc.firstChild
    expect(heading).toBeTruthy()
    expect(editor.state.selection.from).toBe(1)
    expect(editor.state.selection.to).toBe(heading!.nodeSize - 1)
    expect(editor.view.dom.querySelectorAll(".block-selected").length).toBe(1)

    const paragraph = editor.state.doc.child(1)
    const paragraphStart = heading!.nodeSize + 1
    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.create(editor.state.doc, paragraphStart, paragraphStart + 5)),
    )
    expect(editor.view.dom.querySelectorAll(".block-selected").length).toBe(0)

    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 2, paragraphStart + 5)),
    )
    const selected = editor.view.dom.querySelectorAll(".block-selected")
    expect(selected.length).toBe(2)
    expect(selected[0]?.tagName).toBe("H1")
    expect(selected[1]?.tagName).toBe("P")
    expect(editor.state.selection.from).toBe(1)
    expect(editor.state.selection.to).toBe(paragraphStart + paragraph!.content.size)
    editor.destroy()
  })

  it("treats embedded html as raw source", () => {
    expect(prefersRaw("<div>Keep me</div>")).toBe(true)
    expect(prefersRaw("# Plain")).toBe(false)
  })
})
