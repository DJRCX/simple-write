import { useEffect, useRef, type CSSProperties, type ReactNode } from "react"
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  FileText,
  FolderOpen,
  Monitor,
  Sparkles,
  X,
} from "lucide-react"
import { DotPattern } from "@/components/dot-pattern"
import { Playground } from "@/components/playground"

const RELEASES = "https://github.com/DJRCX/simple-write/releases/latest"
const REPO = "https://github.com/DJRCX/simple-write"
const LOGO = "/images/logo.png"

const features = [
  {
    title: "One file per tab",
    body: "Every tab is its own document. Open a Markdown file from anywhere on disk, keep several open at once, and save each one back where it came from — with no vault or notebook folder in the way.",
    icon: FileText,
  },
  {
    title: "Formatted page, raw source",
    body: "Write on a block-style page with headings, lists, tasks, quotes, tables, code, images, math, and Mermaid. When you want the source, switch to raw Markdown with a single shortcut.",
    icon: Sparkles,
  },
  {
    title: "Built for the desk",
    body: "Slash commands, drag-to-reorder blocks, find, focus mode, and light or dark theme. Images copy beside the saved file, and sibling notes open through simple [[wikilinks]].",
    icon: Monitor,
  },
]

const installs = [
  {
    title: "Windows",
    body: "Grab the .msi or .exe from the latest release, run the installer, and Simple Write shows up like any other desktop app — ready to open .md files.",
    icon: Monitor,
  },
  {
    title: "Linux",
    body: "Choose a .deb, .rpm, or AppImage. The AppImage runs as-is; package installs put Simple Write in your application menu and file associations.",
    icon: FolderOpen,
  },
]

const compareRows = [
  { feature: "Open any file, anywhere", vault: false, simple: true, plain: true },
  { feature: "No vault or notebook folder", vault: false, simple: true, plain: true },
  { feature: "Formatted block writing", vault: true, simple: true, plain: false },
  { feature: "Raw Markdown toggle", vault: "partial", simple: true, plain: true },
  { feature: "Mermaid, math, and tables", vault: true, simple: true, plain: false },
  { feature: "Plain .md files on disk", vault: "partial", simple: true, plain: true },
] as const

const shortcuts = [
  ["New", "Ctrl+N"],
  ["Open", "Ctrl+O"],
  ["Save", "Ctrl+S"],
  ["Save As", "Ctrl+Shift+S"],
  ["Find", "Ctrl+F"],
  ["Formatted / Markdown", "Ctrl+Shift+M"],
  ["Focus mode", "Ctrl+Shift+Enter"],
]

function Cell({ value }: { value: boolean | "partial" }) {
  if (value === true) {
    return (
      <span className="cell yes" title="Yes">
        <Check size={16} aria-hidden="true" />
        <span className="sr-only">Yes</span>
      </span>
    )
  }
  if (value === "partial") {
    return <span className="cell partial">Partial</span>
  }
  return (
    <span className="cell no" title="No">
      <X size={16} aria-hidden="true" />
      <span className="sr-only">No</span>
    </span>
  )
}

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.classList.add("is-in")
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          node.classList.add("is-in")
          observer.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -10% 0px" },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const style = {
    "--reveal-delay": `${delay}ms`,
  } as CSSProperties

  return (
    <div ref={ref} className={`reveal ${className}`.trim()} style={style}>
      {children}
    </div>
  )
}

export default function App() {
  const heroRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      heroRef.current?.classList.add("is-in")
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="site-shell">
      <div className="bg-layer" aria-hidden="true">
        <DotPattern
          width={20}
          height={20}
          cx={1}
          cy={1}
          cr={1.2}
          className="dot-field [mask-image:radial-gradient(ellipse_at_center,white,transparent_78%)]"
        />
      </div>

      <header className="site-header">
        <div className="wrap site-header-inner">
          <a className="brand-mark" href="#top">
            <img src={LOGO} alt="" width={28} height={28} />
            Simple Write
          </a>
          <nav className="nav-links" aria-label="Page">
            <a href="#preview">Preview</a>
            <a href="#writing">Writing</a>
            <a href="#compare">Compare</a>
            <a href="#download">Download</a>
            <a href="#shortcuts">Shortcuts</a>
            <a className="nav-github" href={REPO} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main id="top">
        <section
          className="wrap hero reveal"
          ref={heroRef}
          aria-labelledby="hero-title"
        >
          <div className="hero-copy">
            <h1 id="hero-title">Simple Write</h1>
            <p className="lede">
              A desktop Markdown editor for one file at a time. Open a document
              from anywhere, write on a formatted page, and switch to the source
              when you want the raw Markdown.
            </p>
            <div className="cta-row">
              <a className="btn btn-brand" href={RELEASES}>
                Download
                <ArrowRight size={16} aria-hidden="true" />
              </a>
              <a
                className="btn btn-ghost"
                href={REPO}
                target="_blank"
                rel="noreferrer"
              >
                GitHub
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <section
          className="section"
          id="preview"
          aria-labelledby="preview-title"
        >
          <div className="wrap">
            <Reveal className="playground-frame" delay={80}>
              <Playground />
            </Reveal>
          </div>
        </section>

        <section className="section" id="writing" aria-labelledby="writing-title">
          <div className="wrap">
            <Reveal className="section-head">
              <h2 id="writing-title">Made for real documents</h2>
              <p className="section-lede">
                Stay on plain Markdown files. The page is formatted while you
                write; what lands on disk is the source you saved.
              </p>
            </Reveal>
            <div className="card-grid features">
              {features.map((feature, index) => {
                const Icon = feature.icon
                return (
                  <Reveal key={feature.title} className="card" delay={index * 90}>
                    <span className="card-icon" aria-hidden="true">
                      <Icon size={20} />
                    </span>
                    <h3>{feature.title}</h3>
                    <p>{feature.body}</p>
                  </Reveal>
                )
              })}
            </div>
          </div>
        </section>

        <section className="section" id="compare" aria-labelledby="compare-title">
          <div className="wrap">
            <Reveal className="section-head">
              <h2 id="compare-title">Where it sits</h2>
              <p className="section-lede">
                Not a vault for a second brain, and not a bare text box. Simple
                Write is for people who open a file, write, and move on.
              </p>
            </Reveal>
            <Reveal className="compare-shell" delay={80}>
              <div className="compare-scroll">
                <table className="compare-table">
                  <caption className="sr-only">
                    Feature comparison between vault apps, Simple Write, and
                    plain text editors
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Capability</th>
                      <th scope="col">Vault apps</th>
                      <th scope="col" className="featured">
                        <span className="compare-product">
                          <img src={LOGO} alt="" width={18} height={18} />
                          Simple Write
                        </span>
                      </th>
                      <th scope="col">Plain text</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareRows.map((row) => (
                      <tr key={row.feature}>
                        <th scope="row">{row.feature}</th>
                        <td>
                          <Cell value={row.vault} />
                        </td>
                        <td className="featured">
                          <Cell value={row.simple} />
                        </td>
                        <td>
                          <Cell value={row.plain} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="section" id="download" aria-labelledby="download-title">
          <div className="wrap">
            <Reveal className="section-head">
              <h2 id="download-title">Get the desktop app</h2>
              <p className="section-lede">
                Builds for Windows and Linux ship on GitHub Releases. Pick the
                package that matches your system and you are ready to write.
              </p>
            </Reveal>
            <div className="card-grid installs">
              {installs.map((item, index) => {
                const Icon = item.icon
                return (
                  <Reveal key={item.title} className="card" delay={index * 90}>
                    <span className="card-icon" aria-hidden="true">
                      <Icon size={20} />
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </Reveal>
                )
              })}
            </div>
            <Reveal className="cta-row" delay={120}>
              <a className="btn btn-brand" href={RELEASES}>
                Latest release
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </Reveal>
          </div>
        </section>

        <section className="section" id="shortcuts" aria-labelledby="shortcuts-title">
          <div className="wrap">
            <Reveal className="section-head">
              <h2 id="shortcuts-title">Keyboard shortcuts</h2>
              <p className="section-lede">
                File actions follow a familiar desktop editor. Writing shortcuts
                wrap the selection the way you expect.
              </p>
            </Reveal>
            <Reveal className="shortcut-panel" delay={80}>
              <ul className="shortcut-list">
                {shortcuts.map(([action, keys]) => (
                  <li key={action}>
                    <span>{action}</span>
                    <kbd>{keys}</kbd>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="wrap site-footer-inner">
          <p className="footer-brand">
            <img src={LOGO} alt="" width={20} height={20} />
            Simple Write
          </p>
          <p>
            <a href={REPO} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
