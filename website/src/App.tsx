import { ArrowRight, ArrowUpRight } from "lucide-react"

const RELEASES = "https://github.com/DJRCX/simple-write/releases/latest"
const REPO = "https://github.com/DJRCX/simple-write"

const features = [
  {
    title: "One file per tab",
    body: "Open a document from anywhere. There is no notebook folder or vault — each tab is its own file, saved back where it came from.",
  },
  {
    title: "Formatted page, raw Markdown",
    body: "Write on a block editor with headings, lists, tasks, quotes, tables, code, images, math, and Mermaid. Ctrl+Shift+M shows the source.",
  },
  {
    title: "Built for the desk",
    body: "Slash menu, drag-to-reorder blocks, find, focus mode, and light or dark theme. Images land beside the saved file; [[name]] opens a sibling note.",
  },
]

const installs = [
  {
    title: "Windows",
    body: "Download the .msi or .exe installer from the latest release.",
  },
  {
    title: "Linux",
    body: "Use the .deb, .rpm, or AppImage. The AppImage runs directly; install the package that matches your distro.",
  },
]

const shortcuts = [
  ["New", "Ctrl+N"],
  ["Open", "Ctrl+O"],
  ["Save", "Ctrl+S"],
  ["Save As", "Ctrl+Shift+S"],
  ["Find", "Ctrl+F"],
  ["Formatted / Markdown", "Ctrl+Shift+M"],
  ["Focus mode", "Ctrl+Shift+Enter"],
]

export default function App() {
  return (
    <>
      <header className="site-header">
        <div className="wrap site-header-inner">
          <a className="brand-mark" href="#top">
            <img src="/images/logo.png" alt="" width={24} height={24} />
            Simple Write
          </a>
          <nav className="nav-links" aria-label="Page">
            <a href="#features">Features</a>
            <a href="#install">Install</a>
            <a href="#shortcuts">Shortcuts</a>
            <a href={REPO} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="wrap hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">Desktop Markdown editor</p>
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
                View on GitHub
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </div>
          </div>
          <div className="hero-visual">
            <img
              className="hero-logo"
              src="/images/logo-text.png"
              alt="Simple Write wordmark"
              width={280}
              height={224}
            />
          </div>
        </section>

        <section className="section" id="features" aria-labelledby="features-title">
          <div className="wrap">
            <h2 id="features-title">What it does</h2>
            <p className="section-lede">
              Stay on plain Markdown files. The page is formatted; the disk stays
              honest until you save.
            </p>
            <ul className="feature-list">
              {features.map((feature) => (
                <li key={feature.title}>
                  <strong>{feature.title}</strong>
                  <span>{feature.body}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section" id="install" aria-labelledby="install-title">
          <div className="wrap">
            <h2 id="install-title">Install</h2>
            <p className="section-lede">
              Builds for Windows and Linux are on the releases page. Pick the
              package for your system.
            </p>
            <ul className="install-list">
              {installs.map((item) => (
                <li key={item.title}>
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                </li>
              ))}
            </ul>
            <div className="cta-row">
              <a className="btn btn-brand" href={RELEASES}>
                Latest release
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <section
          className="section"
          id="shortcuts"
          aria-labelledby="shortcuts-title"
        >
          <div className="wrap">
            <h2 id="shortcuts-title">Shortcuts</h2>
            <p className="section-lede">
              File actions follow a familiar desktop editor. Writing shortcuts
              wrap the selection as usual.
            </p>
            <ul className="shortcut-list">
              {shortcuts.map(([action, keys]) => (
                <li key={action}>
                  <span>{action}</span>
                  <kbd>{keys}</kbd>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="wrap site-footer-inner">
          <p>Simple Write · open source desktop editor</p>
          <p>
            <a href={REPO} target="_blank" rel="noreferrer">
              github.com/DJRCX/simple-write
            </a>
          </p>
        </div>
      </footer>
    </>
  )
}
