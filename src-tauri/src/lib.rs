use std::fs;
use std::path::{Component, Path, PathBuf};

use serde::Serialize;
use tauri::Manager;

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

/// 선택한 폴더에서 실제 vault 루트를 찾아낸다.
///
/// 저장소 루트에는 앱 소스가 있고 원고는 `vault/` 하위에 있다.
/// 사용자가 저장소 루트를 고르는 것이 자연스러우므로 한 단계 아래까지 찾아본다.
/// 반대로 `vault/canon` 처럼 안쪽을 골랐다면 위로 올라가며 찾는다.
#[tauri::command]
fn find_vault_root(picked: String) -> Option<String> {
    let start = Path::new(&picked);

    // 1. 고른 폴더 자체
    if start.join("AGENTS.md").is_file() {
        return Some(picked);
    }

    // 2. 흔한 하위 폴더 이름
    for name in ["vault", "Vault"] {
        let candidate = start.join(name);
        if candidate.join("AGENTS.md").is_file() {
            return Some(candidate.to_string_lossy().to_string());
        }
    }

    // 3. 상위로 거슬러 올라가며 찾는다 (최대 4단계)
    let mut current = start;
    for _ in 0..4 {
        let Some(parent) = current.parent() else { break };
        if parent.join("AGENTS.md").is_file() {
            return Some(parent.to_string_lossy().to_string());
        }
        current = parent;
    }

    None
}

// ── 플랫폼 로그인 ───────────────────────────────────────────

/// 플랫폼별 로그인 페이지와, 로그인 여부를 판별할 쿠키 이름.
///
/// 두 플랫폼 모두 공개 API 와 토큰 발급이 없다. 로그인으로 얻을 수 있는
/// 것은 세션 쿠키뿐이므로, 로그인은 WebView 안에서 사용자가 직접 한다.
/// 캡차·2단계 인증·소셜 로그인을 우회하지 않는다는 뜻이기도 하다.
struct PlatformSite {
    label: &'static str,
    login_url: &'static str,
    /// 로그인 성공 시 세션 쿠키가 설정되는 도메인
    domain: &'static str,
}

fn platform_site(platform: &str) -> Result<PlatformSite, String> {
    match platform {
        "novelpia" => Ok(PlatformSite {
            label: "노벨피아",
            login_url: "https://novelpia.com/login/",
            domain: "novelpia.com",
        }),
        "joara" => Ok(PlatformSite {
            label: "조아라",
            login_url: "https://www.joara.com/login",
            domain: "joara.com",
        }),
        other => Err(format!("알 수 없는 플랫폼입니다: {other}")),
    }
}

/// 플랫폼 로그인 창을 연다. 로그인은 사용자가 직접 수행한다.
#[tauri::command]
async fn open_login_window(app: tauri::AppHandle, platform: String) -> Result<(), String> {
    let site = platform_site(&platform)?;
    let label = format!("login-{platform}");

    // 이미 열려 있으면 앞으로 가져온다.
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.set_focus();
        return Ok(());
    }

    let url = tauri::WebviewUrl::External(
        site.login_url
            .parse()
            .map_err(|e| format!("주소가 잘못되었습니다: {e}"))?,
    );

    tauri::WebviewWindowBuilder::new(&app, &label, url)
        .title(format!("{} 로그인", site.label))
        .inner_size(980.0, 800.0)
        .build()
        .map_err(|e| format!("로그인 창을 열지 못했습니다: {e}"))?;

    Ok(())
}

/// 해당 플랫폼의 세션 쿠키가 있는지 확인한다.
///
/// 쿠키 이름은 플랫폼마다 다르고 공개되어 있지 않으므로,
/// 도메인에 쿠키가 하나라도 있는지로 느슨하게 판별한다.
/// 확실한 로그인 판별은 실제 작가 페이지 응답을 봐야 가능하다.
#[tauri::command]
async fn is_logged_in(app: tauri::AppHandle, platform: String) -> Result<bool, String> {
    let site = platform_site(&platform)?;

    let Some(win) = app.get_webview_window(&format!("login-{platform}")) else {
        return Ok(false);
    };

    let cookies = win.cookies().map_err(|e| format!("쿠키 조회 실패: {e}"))?;

    Ok(cookies.iter().any(|c| {
        c.domain()
            .map(|d| d.trim_start_matches('.').ends_with(site.domain))
            .unwrap_or(false)
    }))
}

// ── Codex 연동 ──────────────────────────────────────────────

/// 사용자가 지정한 Codex 실행 플래그.
///
/// 승인 절차와 샌드박스를 모두 끄는 옵션이다. 사용자가 자신의 워크플로로
/// 명시한 값이므로 그대로 쓰되, 앱이 임의로 자동 실행하지는 않는다 —
/// 반드시 사용자가 버튼을 눌러야 뜬다.
const CODEX_FLAGS: &str = "--dangerously-bypass-approvals-and-sandbox";

fn codex_command() -> &'static str {
    if cfg!(windows) {
        "codex.cmd"
    } else {
        "codex"
    }
}

/// Codex가 PATH에 있는지 확인한다.
#[tauri::command]
fn codex_available() -> bool {
    std::process::Command::new(codex_command())
        .arg("--version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// vault 디렉터리에서 Codex를 새 터미널 창으로 띄운다.
///
/// Codex는 대화형 TUI라서 앱 안에 출력만 받아오면 쓸 수 없다.
/// 별도 콘솔 창을 열어 사용자가 직접 대화하게 한다.
#[tauri::command]
fn launch_codex(root: String) -> Result<(), String> {
    let dir = Path::new(&root)
        .canonicalize()
        .map_err(|e| format!("vault 경로를 찾을 수 없습니다: {e}"))?;

    if !dir.join("AGENTS.md").is_file() {
        return Err("AGENTS.md 가 없어 vault 로 보이지 않습니다".into());
    }

    #[cfg(windows)]
    {
        // `start` 는 cmd 내장 명령이라 cmd 를 거쳐야 한다.
        // 첫 따옴표 인자는 창 제목으로 소비되므로 빈 제목을 넣어준다.
        std::process::Command::new("cmd")
            .args(["/C", "start", "Story Vault - Codex", "cmd", "/K"])
            .arg(format!("{} {}", codex_command(), CODEX_FLAGS))
            .current_dir(&dir)
            .spawn()
            .map_err(|e| format!("Codex 실행 실패: {e}"))?;
    }

    #[cfg(not(windows))]
    {
        std::process::Command::new(codex_command())
            .arg(CODEX_FLAGS)
            .current_dir(&dir)
            .spawn()
            .map_err(|e| format!("Codex 실행 실패: {e}"))?;
    }

    Ok(())
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
            is_vault,
            find_vault_root,
            codex_available,
            launch_codex,
            open_login_window,
            is_logged_in
        ])
        .run(tauri::generate_context!())
        .expect("Story Vault 실행에 실패했습니다");
}
