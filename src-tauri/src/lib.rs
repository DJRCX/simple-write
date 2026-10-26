use base64::{Engine, engine::general_purpose::STANDARD};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;

struct LaunchPaths(Mutex<Vec<String>>);

fn image_extension(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
}

fn mime_for(path: &Path) -> &'static str {
    match image_extension(path).as_deref() {
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        Some("avif") => "image/avif",
        Some("bmp") => "image/bmp",
        _ => "image/png",
    }
}

fn is_image(path: &Path) -> bool {
    matches!(
        image_extension(path).as_deref(),
        Some("png")
            | Some("jpg")
            | Some("jpeg")
            | Some("gif")
            | Some("webp")
            | Some("svg")
            | Some("avif")
            | Some("bmp")
    )
}

fn document_dir(document_path: &str) -> Result<PathBuf, String> {
    let doc = PathBuf::from(document_path);
    let dir = match doc.parent() {
        Some(parent) if !parent.as_os_str().is_empty() => parent.to_path_buf(),
        _ => PathBuf::from("."),
    };
    if !dir.is_dir() {
        return Err("Save the document before using files beside it.".into());
    }
    Ok(dir)
}

fn resolve_image(document_path: &str, reference: &str) -> Result<PathBuf, String> {
    let reference = reference.trim().trim_matches(|c| c == '<' || c == '>');
    if reference.is_empty() {
        return Err("The image path is empty.".into());
    }
    let path = PathBuf::from(reference);
    let resolved = if path.is_absolute() {
        path
    } else {
        document_dir(document_path)?.join(path)
    };
    if !resolved.is_file() {
        return Err("That image could not be found beside the document.".into());
    }
    if !is_image(&resolved) {
        return Err("That file is not a supported image.".into());
    }
    Ok(resolved)
}

fn unique_destination(dir: &Path, file_name: &std::ffi::OsStr, source: &Path) -> PathBuf {
    let candidate = dir.join(file_name);
    if let (Ok(left), Ok(right)) = (candidate.canonicalize(), source.canonicalize()) {
        if left == right {
            return candidate;
        }
    }
    if !candidate.exists() {
        return candidate;
    }
    let parsed = Path::new(file_name);
    let stem = parsed
        .file_stem()
        .unwrap_or(file_name)
        .to_string_lossy()
        .into_owned();
    let ext = parsed
        .extension()
        .map(|value| value.to_string_lossy().into_owned());
    for index in 2..1000 {
        let name = match &ext {
            Some(extension) => format!("{stem}-{index}.{extension}"),
            None => format!("{stem}-{index}"),
        };
        let next = dir.join(name);
        if !next.exists() {
            return next;
        }
    }
    candidate
}

#[tauri::command]
fn read_text(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);
    if !path.is_file() {
        return Err("That path is not a file.".into());
    }
    fs::read_to_string(&path).map_err(|error| format!("Could not read the file: {error}"))
}

#[tauri::command]
fn write_text(path: String, contents: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            return Err("The folder for that file does not exist.".into());
        }
    }
    fs::write(&path, contents).map_err(|error| format!("Could not save the file: {error}"))
}

#[tauri::command]
fn import_image(document_path: String, source_path: String) -> Result<String, String> {
    let dir = document_dir(&document_path)?;
    let source = PathBuf::from(source_path);
    if !source.is_file() || !is_image(&source) {
        return Err("Choose an image file.".into());
    }
    let file_name = source
        .file_name()
        .ok_or_else(|| "The image has no file name.".to_string())?;
    let destination = unique_destination(&dir, file_name, &source);
    if destination != source {
        fs::copy(&source, &destination)
            .map_err(|error| format!("Could not copy the image: {error}"))?;
    }
    destination
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .ok_or_else(|| "Could not name the copied image.".to_string())
}

#[tauri::command]
fn image_data_url(document_path: String, reference: String) -> Result<String, String> {
    let path = resolve_image(&document_path, &reference)?;
    let bytes = fs::read(&path).map_err(|error| format!("Could not read the image: {error}"))?;
    if bytes.len() > 25 * 1024 * 1024 {
        return Err("That image is larger than 25 MB.".into());
    }
    Ok(format!(
        "data:{};base64,{}",
        mime_for(&path),
        STANDARD.encode(bytes)
    ))
}

#[tauri::command]
fn resolve_wikilink(document_path: String, target: String) -> Result<Option<String>, String> {
    let target = target.trim();
    if target.is_empty() || target.contains('/') || target.contains('\\') || target.contains("..") {
        return Ok(None);
    }
    let dir = document_dir(&document_path)?;
    let candidates = [
        dir.join(target),
        dir.join(format!("{target}.md")),
        dir.join(format!("{target}.markdown")),
    ];
    for candidate in candidates {
        if candidate.is_file() {
            return Ok(Some(candidate.to_string_lossy().into_owned()));
        }
    }
    Ok(None)
}

#[tauri::command]
fn take_launch_paths(state: State<LaunchPaths>) -> Vec<String> {
    std::mem::take(&mut state.0.lock().expect("launch paths lock"))
}

const MARKDOWN_MIME_TYPES: [&str; 2] = ["text/markdown", "text/x-markdown"];

/// AppImages do not install a desktop entry. File pickers only offer applications
/// whose entry lists a Markdown MIME type and accepts a file argument.
fn ensure_markdown_desktop(contents: &str) -> String {
    let mut saw_mime = false;
    let mut out = String::new();
    for line in contents.split_inclusive('\n') {
        let (body, newline) = match line.strip_suffix('\n') {
            Some(body) => (body, "\n"),
            None => (line, ""),
        };
        if let Some(exec) = body.strip_prefix("Exec=") {
            out.push_str("Exec=");
            out.push_str(exec.trim_end());
            if !exec_accepts_path(exec) {
                out.push_str(" %F");
            }
        } else if let Some(mime) = body.strip_prefix("MimeType=") {
            saw_mime = true;
            out.push_str("MimeType=");
            out.push_str(&merge_mime_types(mime));
        } else {
            out.push_str(body);
        }
        out.push_str(newline);
    }
    if !saw_mime {
        if !out.is_empty() && !out.ends_with('\n') {
            out.push('\n');
        }
        out.push_str("MimeType=");
        out.push_str(&merge_mime_types(""));
        out.push('\n');
    }
    out
}

fn exec_accepts_path(exec: &str) -> bool {
    exec.split("%%").any(|part| {
        ["%f", "%F", "%u", "%U"]
            .iter()
            .any(|code| part.contains(code))
    })
}

fn merge_mime_types(existing: &str) -> String {
    let mut types = existing
        .split(';')
        .filter(|mime| !mime.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();
    for mime in MARKDOWN_MIME_TYPES {
        if !types.iter().any(|current| current == mime) {
            types.push(mime.to_string());
        }
    }
    let mut joined = types.join(";");
    joined.push(';');
    joined
}

fn desktop_exec_path(path: &str) -> String {
    if path.contains([' ', '\t', '"', '\\']) {
        format!("\"{}\"", path.replace('\\', "\\\\").replace('"', "\\\""))
    } else {
        path.to_string()
    }
}

fn appimage_desktop_entry(appimage: &str) -> String {
    format!(
        "[Desktop Entry]\nType=Application\nName=Simple Write\nComment=A document-centric Markdown editor\nExec={exec} %F\nTerminal=false\nCategories=Office;TextEditor;\nMimeType={mime}\nStartupWMClass=simple-write\n",
        exec = desktop_exec_path(appimage),
        mime = merge_mime_types("")
    )
}

#[cfg(target_os = "linux")]
fn integrate_appimage() {
    let Ok(appimage) = std::env::var("APPIMAGE") else {
        return;
    };
    if appimage.is_empty() {
        return;
    }
    let Ok(home) = std::env::var("HOME") else {
        return;
    };
    let apps = PathBuf::from(home).join(".local/share/applications");
    if fs::create_dir_all(&apps).is_err() {
        return;
    }

    let mut changed = false;
    let mut found = false;
    if let Ok(entries) = fs::read_dir(&apps) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|ext| ext.to_str()) != Some("desktop") {
                continue;
            }
            let Ok(current) = fs::read_to_string(&path) else {
                continue;
            };
            if !current.contains(&appimage) {
                continue;
            }
            found = true;
            let next = ensure_markdown_desktop(&current);
            if next != current && fs::write(&path, next).is_ok() {
                changed = true;
            }
        }
    }
    if !found {
        let path = apps.join("simple-write.desktop");
        if fs::write(&path, appimage_desktop_entry(&appimage)).is_ok() {
            changed = true;
        }
    }
    if changed {
        let _ = std::process::Command::new("update-desktop-database")
            .arg(&apps)
            .status();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    integrate_appimage();

    let launch_paths = std::env::args()
        .skip(1)
        .filter(|arg| !arg.starts_with('-'))
        .filter(|arg| Path::new(arg).is_file())
        .collect::<Vec<_>>();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(LaunchPaths(Mutex::new(launch_paths)))
        .invoke_handler(tauri::generate_handler![
            read_text,
            write_text,
            import_image,
            image_data_url,
            resolve_wikilink,
            take_launch_paths
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{import_image, read_text, resolve_wikilink, write_text};
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn scratch() -> std::path::PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("simple-write-{nanos}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn round_trips_text_without_adding_a_file_on_read() {
        let dir = scratch();
        let path = dir.join("note.md");
        write_text(path.to_string_lossy().into_owned(), "Hello\n".into()).unwrap();
        let before = fs::metadata(&path).unwrap().modified().unwrap();
        let text = read_text(path.to_string_lossy().into_owned()).unwrap();
        let after = fs::metadata(&path).unwrap().modified().unwrap();
        assert_eq!(text, "Hello\n");
        assert_eq!(before, after);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn copies_an_image_beside_the_document_and_resolves_a_sibling_note() {
        let dir = scratch();
        let note = dir.join("note.md");
        write_text(note.to_string_lossy().into_owned(), "".into()).unwrap();
        write_text(
            dir.join("sibling.md").to_string_lossy().into_owned(),
            "side".into(),
        )
        .unwrap();
        let source_dir = dir.join("incoming");
        fs::create_dir(&source_dir).unwrap();
        let source = source_dir.join("outside.png");
        fs::write(&source, b"\x89PNG\r\n").unwrap();
        let copied = import_image(
            note.to_string_lossy().into_owned(),
            source.to_string_lossy().into_owned(),
        )
        .unwrap();
        assert_eq!(copied, "outside.png");
        assert!(dir.join("outside.png").is_file());
        let again = import_image(
            note.to_string_lossy().into_owned(),
            dir.join("outside.png").to_string_lossy().into_owned(),
        )
        .unwrap();
        assert_eq!(again, "outside.png");
        let linked =
            resolve_wikilink(note.to_string_lossy().into_owned(), "sibling".into()).unwrap();
        assert_eq!(
            linked.as_deref(),
            Some(dir.join("sibling.md").to_string_lossy().as_ref())
        );
        assert!(
            resolve_wikilink(note.to_string_lossy().into_owned(), "../secret".into())
                .unwrap()
                .is_none()
        );
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn desktop_entry_advertises_markdown_and_accepts_a_file() {
        let installed = "\
[Desktop Entry]
Type=Application
Name=Simple Write
Exec=env DESKTOPINTEGRATION=1 /home/djrcx/AppImages/simple_write.appimage
Terminal=false
Categories=;
";
        let updated = super::ensure_markdown_desktop(installed);
        assert!(updated.contains(
            "Exec=env DESKTOPINTEGRATION=1 /home/djrcx/AppImages/simple_write.appimage %F\n"
        ));
        assert!(updated.contains("MimeType=text/markdown;text/x-markdown;\n"));
        assert_eq!(super::ensure_markdown_desktop(&updated), updated);

        let created = super::appimage_desktop_entry("/opt/Simple Write.AppImage");
        assert!(created.contains("Exec=\"/opt/Simple Write.AppImage\" %F\n"));
        assert!(created.contains("MimeType=text/markdown;text/x-markdown;\n"));
    }
}
