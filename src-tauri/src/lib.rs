use std::fs;
use std::path::{Component, Path, PathBuf};

use serde::Serialize;

/// 파일 트리의 한 항목.
#[derive(Serialize)]
pub struct Entry {
    /// vault 루트로부터의 상대 경로 (항상 `/` 구분자)
    path: String,
    name: String,
    is_dir: bool,
    children: Vec<Entry>,
}

/// vault 루트를 벗어나는 경로 접근을 막는다.
///
/// 프런트엔드가 보내는 상대 경로를 그대로 신뢰하면 `../../` 로
/// 임의 파일을 읽고 쓸 수 있다. 정규화한 뒤 루트 하위인지 확인한다.
fn resolve(root: &str, relative: &str) -> Result<PathBuf, String> {
    let root = Path::new(root)
        .canonicalize()
        .map_err(|e| format!("vault 루트를 찾을 수 없습니다: {e}"))?;

    // 상위 이동과 절대 경로 성분을 애초에 거부한다.
    let rel = Path::new(relative);
    for c in rel.components() {
        match c {
            Component::Normal(_) => {}
            _ => return Err(format!("허용되지 않는 경로입니다: {relative}")),
        }
    }

    let joined = root.join(rel);

    // 심볼릭 링크로 루트를 빠져나가는 경우까지 막는다.
    // 새 파일은 아직 존재하지 않으므로 부모 디렉터리를 기준으로 검사한다.
    let check = if joined.exists() {
        joined.canonicalize().map_err(|e| e.to_string())?
    } else {
        let parent = joined
            .parent()
            .ok_or_else(|| "잘못된 경로입니다".to_string())?;
        let parent = parent
            .canonicalize()
            .map_err(|e| format!("상위 디렉터리를 찾을 수 없습니다: {e}"))?;
        parent.join(joined.file_name().unwrap_or_default())
    };

    if !check.starts_with(&root) {
        return Err(format!("vault 루트 밖의 경로입니다: {relative}"));
    }

    Ok(joined)
}

fn is_hidden(name: &str) -> bool {
    name.starts_with('.')
}

fn read_tree(dir: &Path, root: &Path) -> Vec<Entry> {
    let mut entries: Vec<Entry> = Vec::new();

    let Ok(iter) = fs::read_dir(dir) else {
        return entries;
    };

    for item in iter.flatten() {
        let path = item.path();
        let name = item.file_name().to_string_lossy().to_string();

        if is_hidden(&name) {
            continue;
        }

        let is_dir = path.is_dir();

        // 마크다운 외 파일은 트리에 노출하지 않는다.
        if !is_dir && !name.to_lowercase().ends_with(".md") {
            continue;
        }

        let rel = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");

        let children = if is_dir {
            read_tree(&path, root)
        } else {
            Vec::new()
        };

        // 마크다운이 하나도 없는 빈 디렉터리는 감춘다.
        if is_dir && children.is_empty() {
            continue;
        }

        entries.push(Entry {
            path: rel,
            name,
            is_dir,
            children,
        });
    }

    // 디렉터리 먼저, 그다음 이름순.
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.cmp(&b.name),
    });

    entries
}

#[tauri::command]
fn list_tree(root: String) -> Result<Vec<Entry>, String> {
    let root_path = Path::new(&root)
        .canonicalize()
        .map_err(|e| format!("vault 루트를 열 수 없습니다: {e}"))?;
    Ok(read_tree(&root_path, &root_path))
}

#[tauri::command]
fn read_file(root: String, path: String) -> Result<String, String> {
    let full = resolve(&root, &path)?;
    fs::read_to_string(&full).map_err(|e| format!("읽기 실패: {e}"))
}

#[tauri::command]
fn write_file(root: String, path: String, contents: String) -> Result<(), String> {
    let full = resolve(&root, &path)?;
    if let Some(parent) = full.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("디렉터리 생성 실패: {e}"))?;
    }
    fs::write(&full, contents).map_err(|e| format!("쓰기 실패: {e}"))
}

/// 이 디렉터리가 Story Vault 구조인지 확인한다.
#[tauri::command]
fn is_vault(root: String) -> bool {
    Path::new(&root).join("AGENTS.md").is_file()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init());

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .invoke_handler(tauri::generate_handler![
            list_tree,
            read_file,
            write_file,
            is_vault
        ])
        .run(tauri::generate_context!())
        .expect("Story Vault 실행에 실패했습니다");
}
