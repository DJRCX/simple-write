import { readFileSync, appendFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const confPath = join(root, "src-tauri/tauri.conf.json")
const logPath = join(root, ".cursor/debug-b6a79f.log")
const endpoint = "http://127.0.0.1:7823/ingest/247c2de0-5423-45f0-8972-d20d2dacb247"

function log(hypothesisId, message, data) {
  const payload = {
    sessionId: "b6a79f",
    runId: process.env.DEBUG_RUN_ID || "pre-fix",
    hypothesisId,
    location: "scripts/check-file-associations.mjs",
    message,
    data,
    timestamp: Date.now(),
  }
  // #region agent log
  try {
    mkdirSync(dirname(logPath), { recursive: true })
    appendFileSync(logPath, `${JSON.stringify(payload)}\n`)
  } catch {}
  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "b6a79f" },
    body: JSON.stringify(payload),
  }).catch(() => {})
  // #endregion
  console.log(`[${hypothesisId}] ${message}`, JSON.stringify(data))
}

const conf = JSON.parse(readFileSync(confPath, "utf8"))
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

const mimeTypes = associations.map((item) => item.mimeType).filter(Boolean)
const hasMarkdownAliasPair =
  mimeTypes.includes("text/markdown") && mimeTypes.includes("text/x-markdown")

// #region agent log
log("A", "Duplicate file extension associations", {
  associationCount: associations.length,
  extensions: [...seen.keys()],
  duplicates,
  wouldBreakWix: duplicates.length > 0,
})
log("B", "Markdown MIME alias coverage via separate associations", {
  mimeTypes,
  hasMarkdownAliasPair,
  linuxAliasIsSubclassOfCanonical: true,
})
log("C", "Release-notes shell is bash on all runners", {
  workflowUsesBashShell: true,
  rejectedByCiEvidence: "Windows reached WiX light.exe, so notes step passed",
})
log("D", "WiX tooling presence inferred from CI", {
  candleRan: true,
  failureStage: "light.exe Extension table",
  rejectedMissingTools: true,
})
log("E", "Product name space collision check", {
  productName: conf.productName,
  mainBinaryName: conf.mainBinaryName,
  rejectedByCiEvidence: "Error key is md/Path, not product name",
})
// #endregion

if (duplicates.length) {
  console.error(
    `Found ${duplicates.length} duplicated file association extension(s). Windows WiX rejects this with LGHT0130.`,
  )
  process.exit(1)
}

console.log("File associations look unique.")
