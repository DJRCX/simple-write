import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import type { Editor, Range } from "@tiptap/core"
import type { SuggestionProps } from "@tiptap/suggestion"
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"

export type SlashItem = {
  id: string
  label: string
  keywords: string
  apply: () => void
  run: (editor: Editor, range: Range) => void
}

export type SlashListHandle = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

export const SlashList = forwardRef<SlashListHandle, SuggestionProps<SlashItem, SlashItem>>(
  function SlashList(props, ref) {
    const [index, setIndex] = useState(0)
    const indexRef = useRef(0)
    const listRef = useRef<HTMLDivElement>(null)
    const itemKey = props.items.map((item) => item.id).join("\n")

    function choose(next: number) {
      indexRef.current = next
      setIndex(next)
    }

    useEffect(() => {
      choose(0)
    }, [itemKey])

    useEffect(() => {
      const list = listRef.current
      const item = list?.querySelector<HTMLElement>("[data-active='true']")
      if (!list || !item) return
      const listRect = list.getBoundingClientRect()
      const itemRect = item.getBoundingClientRect()
      if (itemRect.top < listRect.top) list.scrollTop -= listRect.top - itemRect.top
      else if (itemRect.bottom > listRect.bottom) list.scrollTop += itemRect.bottom - listRect.bottom
    }, [index, itemKey])

    function onListKeyDown(event: KeyboardEvent) {
      if (!props.items.length) return false
      if (event.key === "ArrowDown") {
        event.preventDefault()
        choose((indexRef.current + 1) % props.items.length)
        return true
      }
      if (event.key === "ArrowUp") {
        event.preventDefault()
        choose((indexRef.current - 1 + props.items.length) % props.items.length)
        return true
      }
      if (event.key === "Enter") {
        event.preventDefault()
        props.command(props.items[indexRef.current])
        return true
      }
      if (event.key === "Escape") return true
      return false
    }

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => onListKeyDown(event),
    }))

    return (
      <Command
        shouldFilter={false}
        value={props.items[index]?.id ?? ""}
        aria-label="Slash commands"
        className="w-72 border border-border shadow-md"
        onKeyDownCapture={(event) => {
          if (onListKeyDown(event.nativeEvent)) event.stopPropagation()
        }}
      >
        <CommandList ref={listRef}>
          <CommandEmpty>No matching blocks</CommandEmpty>
          <CommandGroup>
            {props.items.map((item, itemIndex) => (
              <CommandItem
                key={item.id}
                value={item.id}
                data-active={itemIndex === index ? "true" : "false"}
                aria-selected={itemIndex === index}
                className={itemIndex === index ? "bg-muted" : undefined}
                onMouseMove={(event) => {
                  if (event.movementX === 0 && event.movementY === 0) return
                  if (indexRef.current !== itemIndex) choose(itemIndex)
                }}
                onMouseDown={(event) => event.preventDefault()}
                onSelect={() => props.command(item)}
              >
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    )
  },
)
