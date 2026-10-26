import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import type { Editor } from "@tiptap/core"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { NodeSelection } from "@tiptap/pm/state"
import { GripVerticalIcon, PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const alignable = new Set(["paragraph", "heading", "image", "codeBlock"])

type BlockTarget = {
  pos: number
  align: string
  top: number
  alignable: boolean
}

type DropSpot = {
  insertAt: number
  top: number
}

type DragState = {
  pointerId: number
  startX: number
  startY: number
  from: number
  active: boolean
}

function isHandleBlock(node: ProseMirrorNode, parent: ProseMirrorNode | null) {
  if (node.type.name === "paragraph") {
    const parentName = parent?.type.name
    return parentName !== "listItem" && parentName !== "taskItem" && parentName !== "blockquote" && parentName !== "tableCell" && parentName !== "tableHeader"
  }
  return node.type.name === "heading" || node.type.name === "listItem" || node.type.name === "taskItem" || node.type.name === "codeBlock" || node.type.name === "image" || node.type.name === "blockquote" || node.type.name === "horizontalRule" || node.type.name === "table"
}

function findBlock(editor: Editor, pos: number) {
  const clamped = Math.max(0, Math.min(pos, editor.state.doc.content.size))
  const resolved = editor.state.doc.resolve(clamped)
  const beside = resolved.nodeAfter
  if (beside && isHandleBlock(beside, resolved.parent)) return { pos: clamped, node: beside }
  for (let depth = resolved.depth; depth > 0; depth -= 1) {
    const node = resolved.node(depth)
    const parent = resolved.node(depth - 1)
    if (isHandleBlock(node, parent)) return { pos: resolved.before(depth), node }
  }
  return null
}

function readAlign(node: ProseMirrorNode) {
  return node.attrs.textAlign === "center" || node.attrs.textAlign === "right" ? node.attrs.textAlign : "left"
}

function insertionPoint(doc: ProseMirrorNode, blockPos: number) {
  const node = doc.nodeAt(blockPos)
  if (!node) return null
  const paragraph = node.type.schema.nodes.paragraph
  const resolved = doc.resolve(blockPos)
  for (let depth = resolved.depth; depth >= 0; depth -= 1) {
    const parent = depth === resolved.depth ? resolved.parent : resolved.node(depth)
    const index = depth === resolved.depth ? resolved.index() : resolved.index(depth)
    if (!parent.canReplaceWith(index + 1, index + 1, paragraph)) continue
    return depth === resolved.depth ? blockPos + node.nodeSize : resolved.after(depth + 1)
  }
  return null
}

function moveNode(editor: Editor, from: number, to: number) {
  const node = editor.state.doc.nodeAt(from)
  if (!node) return
  const size = node.nodeSize
  if (to === from || to === from + size) return
  const tr = editor.state.tr
  if (to < from) {
    tr.insert(to, node)
    const mapped = tr.mapping.map(from)
    tr.delete(mapped, mapped + size)
    tr.setSelection(NodeSelection.create(tr.doc, to))
  } else {
    tr.delete(from, from + size)
    const mapped = tr.mapping.map(to)
    tr.insert(mapped, node)
    tr.setSelection(NodeSelection.create(tr.doc, mapped))
  }
  editor.view.dispatch(tr)
}

function dropSpot(editor: Editor, from: number, clientY: number, host: HTMLElement): DropSpot | null {
  const node = editor.state.doc.nodeAt(from)
  if (!node) return null
  const resolved = editor.state.doc.resolve(from)
  const parent = resolved.parent
  const origin = resolved.start()
  const hostTop = host.getBoundingClientRect().top
  let nearest: DropSpot & { distance: number } | null = null
  parent.forEach((child, offset) => {
    const pos = origin + offset
    let dom: unknown
    try {
      dom = editor.view.nodeDOM(pos)
    } catch {
      return
    }
    if (!(dom instanceof HTMLElement)) return
    const rect = dom.getBoundingClientRect()
    const edges = [
      { insertAt: pos, edge: rect.top },
      { insertAt: pos + child.nodeSize, edge: rect.bottom },
    ]
    for (const edge of edges) {
      const distance = Math.abs(clientY - edge.edge)
      if (!nearest || distance < nearest.distance) {
        nearest = { insertAt: edge.insertAt, top: edge.edge - hostTop, distance }
      }
    }
  })
  if (!nearest) return null
  return { insertAt: nearest.insertAt, top: nearest.top }
}

export function BlockAlign({ editor, host }: { editor: Editor; host: HTMLElement | null }) {
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<BlockTarget | null>(null)
  const [drop, setDrop] = useState<DropSpot | null>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const dropRef = useRef<DropSpot | null>(null)
  const suppressMenu = useRef(false)

  useEffect(() => {
    if (!host) return

    function place(position: number | null) {
      if (editor.isDestroyed) return
      if (position === null) {
        if (!open && !dragRef.current?.active) setTarget(null)
        return
      }
      const found = findBlock(editor, position)
      if (!found) {
        if (!open && !dragRef.current?.active) setTarget(null)
        return
      }
      let dom: unknown
      try {
        dom = editor.view.nodeDOM(found.pos)
      } catch {
        return
      }
      if (!(dom instanceof HTMLElement)) return
      const top = dom.getBoundingClientRect().top - host.getBoundingClientRect().top
      setTarget({ pos: found.pos, align: readAlign(found.node), top, alignable: alignable.has(found.node.type.name) })
    }

    function fromSelection() {
      place(editor.state.selection.from)
    }

    function onMove(event: MouseEvent) {
      if (dragRef.current?.active) return
      if (controlsRef.current?.contains(event.target as Node)) return
      const content = editor.view.dom.getBoundingClientRect()
      const left = Math.min(Math.max(event.clientX, content.left + 2), content.right - 2)
      const hit = editor.view.posAtCoords({ left, top: event.clientY })
      if (hit) place(hit.pos)
    }

    function onLeave(event: MouseEvent) {
      if (dragRef.current?.active || open) return
      if (event.relatedTarget instanceof Node && host.contains(event.relatedTarget)) return
      place(null)
    }

    const frame = requestAnimationFrame(fromSelection)
    editor.on("selectionUpdate", fromSelection)
    editor.on("transaction", fromSelection)
    host.addEventListener("mousemove", onMove)
    host.addEventListener("mouseleave", onLeave)
    return () => {
      cancelAnimationFrame(frame)
      editor.off("selectionUpdate", fromSelection)
      editor.off("transaction", fromSelection)
      host.removeEventListener("mousemove", onMove)
      host.removeEventListener("mouseleave", onLeave)
    }
  }, [editor, host, open])

  function rememberDrop(next: DropSpot | null) {
    dropRef.current = next
    setDrop(next)
  }

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || !target) return
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, from: target.pos, active: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId || !host) return
    if (!drag.active && Math.abs(event.clientY - drag.startY) < 8 && Math.abs(event.clientX - drag.startX) < 8) return
    if (!drag.active) {
      drag.active = true
      suppressMenu.current = true
      setOpen(false)
      document.body.style.cursor = "grabbing"
    }
    rememberDrop(dropSpot(editor, drag.from, event.clientY, host))
  }

  function onPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    document.body.style.cursor = ""
    const destination = dropRef.current
    rememberDrop(null)
    if (!drag.active || !destination) return
    event.preventDefault()
    event.stopPropagation()
    moveNode(editor, drag.from, destination.insertAt)
  }

  function addBlock() {
    if (!target) return
    const insertAt = insertionPoint(editor.state.doc, target.pos)
    if (insertAt === null) return
    editor.chain().focus().insertContentAt(insertAt, { type: "paragraph" }).setTextSelection(insertAt + 1).insertContent("/").run()
  }

  function apply(align: string) {
    if (!target || (align !== "left" && align !== "center" && align !== "right")) return
    const node = editor.state.doc.nodeAt(target.pos)
    const chain = editor.chain().focus()
    if (node?.isAtom) chain.setNodeSelection(target.pos)
    else chain.setTextSelection(target.pos + 1)
    chain.setTextAlign(align).run()
    setTarget((current) => (current ? { ...current, align } : current))
  }

  const grip = (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={target?.alignable ? "Move block or change alignment" : "Move block"}
      tabIndex={-1}
      className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(event) => {
        if (!suppressMenu.current) return
        suppressMenu.current = false
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      <GripVerticalIcon />
    </Button>
  )

  return (
    <>
      {drop ? <div className="pointer-events-none absolute right-0 left-16 z-10 h-0.5 bg-primary" style={{ top: drop.top }} /> : null}
      {target ? (
        <div ref={controlsRef} className="absolute left-0 z-10 flex items-center" style={{ top: target.top }}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Add block"
            tabIndex={-1}
            className="text-muted-foreground"
            onMouseDown={(event) => event.preventDefault()}
            onClick={addBlock}
          >
            <PlusIcon />
          </Button>
          {target.alignable ? (
            <DropdownMenu
              open={open}
              onOpenChange={(next) => {
                if (next && suppressMenu.current) return
                setOpen(next)
                if (!next || !target) return
                const node = editor.state.doc.nodeAt(target.pos)
                if (node) editor.chain().setNodeSelection(target.pos).run()
              }}
            >
              <DropdownMenuTrigger render={grip} />
              <DropdownMenuContent align="start" side="right">
                <DropdownMenuRadioGroup value={target.align} onValueChange={apply}>
                  <DropdownMenuRadioItem value="left">Align left</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="center">Align center</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="right">Align right</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            grip
          )}
        </div>
      ) : null}
    </>
  )
}
