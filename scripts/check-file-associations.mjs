import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const conf = JSON.parse(readFileSync(join(root, "src-tauri/tauri.conf.json"), "utf8"))
const associations = conf.bundle?.fileAssociations ?? []
const seen = new Map()
const duplicates = []

for (const [index, association] of associations.entries()) {
  for (const raw of association.ext ?? []) {
    const ext = String(raw).replace(/^\./, "").toLowerCase()
    const previous = seen.get(ext)
    if (previous !== undefined) {
      duplicates.push({
        ext,
        firstIndex: previous,
        secondIndex: index,
        firstMime: associations[previous]?.mimeType ?? null,
        secondMime: association.mimeType ?? null,
      })
    } else {
      seen.set(ext, index)
    }
  }
}

if (duplicates.length) {
  console.error(
    `Found ${duplicates.length} duplicated file association extension(s). Windows WiX rejects this with LGHT0130.`,
  )
  for (const duplicate of duplicates) {
    console.error(
      `  .${duplicate.ext} appears in associations ${duplicate.firstIndex} (${duplicate.firstMime}) and ${duplicate.secondIndex} (${duplicate.secondMime})`,
    )
  }
  process.exit(1)
}

console.log("File associations look unique.")
