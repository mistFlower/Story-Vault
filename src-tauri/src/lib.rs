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

// ── 새 vault 만들기 ─────────────────────────────────────────

/// 앱에 내장된 vault 템플릿.
///
/// 저장소의 `templates/vault/` 를 그대로 굽는다. 작업용 `vault/` 가 아니라
/// 템플릿을 쓰는 이유는, 그쪽에 실제 원고가 쌓이면 새 작품을 만들 때
/// 남의 원고가 딸려 들어가기 때문이다.
const TEMPLATE: &[(&str, &str)] = &[
    ("AGENTS.md", include_str!("../../templates/vault/AGENTS.md")),
    ("PLATFORM.md", include_str!("../../templates/vault/PLATFORM.md")),
    ("canon/world.md", include_str!("../../templates/vault/canon/world.md")),
    ("canon/characters.md", include_str!("../../templates/vault/canon/characters.md")),
    ("canon/terminology.md", include_str!("../../templates/vault/canon/terminology.md")),
    ("plot/master_plot.md", include_str!("../../templates/vault/plot/master_plot.md")),
    ("plot/current_arc.md", include_str!("../../templates/vault/plot/current_arc.md")),
    ("plot/foreshadowing.md", include_str!("../../templates/vault/plot/foreshadowing.md")),
    ("state/continuity.md", include_str!("../../templates/vault/state/continuity.md")),
    ("analytics/reader_feedback.md", include_str!("../../templates/vault/analytics/reader_feedback.md")),
    ("analytics/episode_metrics.md", include_str!("../../templates/vault/analytics/episode_metrics.md")),
    ("prompts/COMMANDS.md", include_str!("../../templates/vault/prompts/COMMANDS.md")),
    ("archive/deprecated_settings.md", include_str!("../../templates/vault/archive/deprecated_settings.md")),
];

/// 원고가 들어갈 빈 디렉터리.
const TEMPLATE_DIRS: &[&str] = &["episodes/published", "episodes/drafts"];

/// 앱이 관리하는 파일의 판 번호.
///
/// 집필 규칙이나 명령 템플릿을 고칠 때마다 올린다. 기존 vault 는
/// init_vault 가 건드리지 않으므로, 이 번호로 낡은 vault 를 찾아내
/// 사용자에게 갱신 여부를 묻는다.
const TEMPLATE_VERSION: u32 = 2;

/// 앱이 관리하는 파일 — 갱신 대상.
///
/// 사용자 창작물(canon/, plot/, state/, episodes/)은 여기 넣지 않는다.
/// 그쪽은 어떤 경우에도 앱이 덮어쓰지 않는다.
const MANAGED: &[&str] = &["AGENTS.md", "prompts/COMMANDS.md"];

fn template_contents(rel: &str) -> Option<&'static str> {
    TEMPLATE.iter().find(|(p, _)| *p == rel).map(|(_, c)| *c)
}

/// vault 에 기록된 판 번호를 읽는다. 표시가 없으면 1 (최초 판).
fn read_vault_version(dir: &Path) -> u32 {
    fs::read_to_string(dir.join(".story-vault-version"))
        .ok()
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(1)
}

fn write_vault_version(dir: &Path, v: u32) -> Result<(), String> {
    fs::write(dir.join(".story-vault-version"), v.to_string())
        .map_err(|e| format!("판 번호 기록 실패: {e}"))
}

#[derive(Serialize)]
pub struct TemplateStatus {
    vault_version: u32,
    app_version: u32,
    /// 내용이 최신 템플릿과 다른 관리 파일
    outdated: Vec<String>,
    /// 그중 사용자가 손댄 것으로 보이는 파일 (덮어쓰면 편집분이 사라짐)
    modified: Vec<String>,
}

/// 관리 파일이 최신인지 확인한다.
#[tauri::command]
fn check_templates(root: String) -> Result<TemplateStatus, String> {
    let dir = Path::new(&root);
    let vault_version = read_vault_version(dir);

    let mut outdated = Vec::new();
    let mut modified = Vec::new();

    for rel in MANAGED {
        let Some(latest) = template_contents(rel) else {
            continue;
        };
        let path = dir.join(rel);
        let Ok(current) = fs::read_to_string(&path) else {
            // 파일 자체가 없으면 낡은 것으로 본다.
            outdated.push((*rel).to_string());
            continue;
        };

        // 개행 차이(CRLF/LF)는 무시한다.
        let norm = |s: &str| s.replace("\r\n", "\n");
        if norm(&current) != norm(latest) {
            outdated.push((*rel).to_string());

            // 판 번호가 이미 최신인데 내용이 다르면 사용자가 고친 것이다.
            if vault_version >= TEMPLATE_VERSION {
                modified.push((*rel).to_string());
            }
        }
    }

    Ok(TemplateStatus {
        vault_version,
        app_version: TEMPLATE_VERSION,
        outdated,
        modified,
    })
}

/// 관리 파일을 최신 템플릿으로 갱신한다.
///
/// 기존 파일은 archive/ 에 백업한다. 사용자가 규칙을 고쳐 뒀을 수 있고,
/// 그것을 말없이 날리면 안 되기 때문이다.
#[tauri::command]
fn upgrade_templates(root: String, files: Vec<String>) -> Result<Vec<String>, String> {
    let dir = Path::new(&root)
        .canonicalize()
        .map_err(|e| format!("vault 경로를 찾을 수 없습니다: {e}"))?;

    let mut done = Vec::new();

    for rel in &files {
        if !MANAGED.contains(&rel.as_str()) {
            return Err(format!("갱신 대상이 아닌 파일입니다: {rel}"));
        }
        let Some(latest) = template_contents(rel) else {
            continue;
        };

        let target = resolve(&root, rel)?;

        // 기존 내용이 있으면 백업한다.
        if let Ok(current) = fs::read_to_string(&target) {
            let backup_name = format!(
                "{}.v{}.bak",
                rel.replace('/', "_"),
                read_vault_version(&dir)
            );
            let backup = dir.join("archive").join(backup_name);
            if let Some(parent) = backup.parent() {
                fs::create_dir_all(parent).map_err(|e| format!("백업 폴더 생성 실패: {e}"))?;
            }
            fs::write(&backup, current).map_err(|e| format!("백업 실패: {e}"))?;
        }

        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("디렉터리 생성 실패: {e}"))?;
        }
        fs::write(&target, latest).map_err(|e| format!("{rel}: 쓰기 실패: {e}"))?;
        done.push(rel.clone());
    }

    write_vault_version(&dir, TEMPLATE_VERSION)?;
    Ok(done)
}

/// 플랫폼별 집필 기준 리서치 원문. 앱에 굽는다.
///
/// 새 vault 는 저장소 밖(예: E:\소설\노벨피아)에 만들어지므로
/// docs/research/ 를 참조할 수 없다. 선택한 플랫폼의 문서를 vault 안에
/// 써넣어야 Codex 가 읽을 수 있다.
const GUIDE_NOVELPIA: &str = include_str!("../../docs/research/novelpia-codex-research.md");
const GUIDE_JOARA: &str = include_str!("../../docs/research/joara-codex-research.md");

/// vault 안에서 플랫폼 기준 문서가 놓이는 자리.
const GUIDE_PATH: &str = "reference/PLATFORM_GUIDE.md";

fn guide_for(platform: &str) -> Result<&'static str, String> {
    match platform {
        "novelpia" => Ok(GUIDE_NOVELPIA),
        "joara" => Ok(GUIDE_JOARA),
        other => Err(format!("알 수 없는 플랫폼입니다: {other}")),
    }
}

/// 선택한 플랫폼의 기준 문서를 vault 에 써넣는다.
///
/// 플랫폼을 바꾸면 덮어쓴다 — 두 플랫폼의 기준이 섞이면 안 되기 때문이다.
#[tauri::command]
fn write_platform_guide(root: String, platform: String) -> Result<(), String> {
    let contents = guide_for(&platform)?;
    let target = resolve(&root, GUIDE_PATH)?;

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("디렉터리 생성 실패: {e}"))?;
    }

    let label = if platform == "novelpia" { "노벨피아" } else { "조아라" };
    let header = format!(
        "<!-- 이 파일은 앱이 자동 생성한다. 대상 플랫폼을 바꾸면 덮어쓰인다. -->\n\
         <!-- 현재 기준: {label} -->\n\n"
    );

    fs::write(&target, format!("{header}{contents}"))
        .map_err(|e| format!("기준 문서 쓰기 실패: {e}"))
}

/// 폴더가 새 vault 를 만들기에 적합한지 살펴본다.
#[derive(Serialize)]
pub struct VaultCandidate {
    /// 이미 vault 인가 (AGENTS.md 존재)
    is_vault: bool,
    /// 비어 있는가 (숨김 파일 제외)
    is_empty: bool,
    /// 비어 있지 않다면 눈에 띄는 항목 몇 개
    existing: Vec<String>,
}

#[tauri::command]
fn inspect_folder(path: String) -> Result<VaultCandidate, String> {
    let dir = Path::new(&path);
    if !dir.is_dir() {
        return Err("폴더가 아닙니다".into());
    }

    let mut existing: Vec<String> = Vec::new();
    if let Ok(iter) = fs::read_dir(dir) {
        for item in iter.flatten() {
            let name = item.file_name().to_string_lossy().to_string();
            if is_hidden(&name) {
                continue;
            }
            existing.push(name);
            if existing.len() >= 8 {
                break;
            }
        }
    }
    existing.sort();

    Ok(VaultCandidate {
        is_vault: dir.join("AGENTS.md").is_file(),
        is_empty: existing.is_empty(),
        existing,
    })
}

/// 지정한 폴더에 새 vault 구조를 만든다.
///
/// 이미 AGENTS.md 가 있으면 거부한다 — 기존 작품을 덮어쓰는 사고를 막는다.
#[tauri::command]
fn init_vault(path: String) -> Result<String, String> {
    let dir = Path::new(&path);
    if !dir.is_dir() {
        return Err("폴더가 아닙니다".into());
    }
    if dir.join("AGENTS.md").is_file() {
        return Err("이미 vault 입니다. 덮어쓰지 않습니다.".into());
    }

    for (rel, contents) in TEMPLATE {
        let target = dir.join(rel);
        // 혹시 일부 파일만 있는 폴더라면 기존 파일은 건드리지 않는다.
        if target.exists() {
            continue;
        }
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("{rel}: 디렉터리 생성 실패: {e}"))?;
        }
        fs::write(&target, contents).map_err(|e| format!("{rel}: 쓰기 실패: {e}"))?;
    }

    for rel in TEMPLATE_DIRS {
        fs::create_dir_all(dir.join(rel)).map_err(|e| format!("{rel}: 디렉터리 생성 실패: {e}"))?;
    }

    // 새로 만든 vault 는 당연히 최신 판이다.
    write_vault_version(dir, TEMPLATE_VERSION)?;

    dir.canonicalize()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| format!("경로 확인 실패: {e}"))
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
    /// 세션을 담는 쿠키 이름.
    ///
    /// 노벨피아의 LOGINKEY 는 오픈소스 구현들에서 확인된 값이다.
    /// 조아라는 공개된 자료가 없어 아직 모른다 — None 이면 도메인의
    /// 아무 쿠키나 있으면 로그인된 것으로 느슨하게 본다.
    session_cookie: Option<&'static str>,
}

fn platform_site(platform: &str) -> Result<PlatformSite, String> {
    match platform {
        "novelpia" => Ok(PlatformSite {
            label: "노벨피아",
            login_url: "https://novelpia.com/login/",
            domain: "novelpia.com",
            session_cookie: Some("LOGINKEY"),
        }),
        "joara" => Ok(PlatformSite {
            label: "조아라",
            login_url: "https://www.joara.com/login",
            domain: "joara.com",
            session_cookie: None,
        }),
        other => Err(format!("알 수 없는 플랫폼입니다: {other}")),
    }
}

/// 로그인 창에서 얻은 세션.
#[derive(Serialize, Clone)]
pub struct Session {
    platform: String,
    /// 세션 쿠키 이름 (노벨피아면 LOGINKEY)
    name: String,
    /// 값은 프런트엔드로 보내지 않는다. 화면에 띄울 이유가 없고,
    /// 웹뷰 콘솔이나 로그로 새어나갈 여지를 만들지 않기 위해서다.
    ///
    /// 작가 페이지 조회 요청에 실어 보낼 값이다. 조회 계층이 아직 없어
    /// 지금은 읽는 곳이 없다.
    #[serde(skip)]
    #[allow(dead_code)]
    value: String,
    /// 사람이 보기 위한 가림 표시 (앞 4자리만)
    masked: String,
}

#[derive(Default)]
pub struct SessionState(std::sync::Mutex<Option<Session>>);

/// 로그인 창의 쿠키에서 세션을 꺼내 보관한다.
///
/// 이 값이 있으면 이후 작가 페이지 요청에 그대로 실어 보낼 수 있다.
/// 비밀번호를 앱이 받지 않고도 인증된 요청이 가능해진다.
#[tauri::command]
async fn capture_session(
    app: tauri::AppHandle,
    state: tauri::State<'_, SessionState>,
    platform: String,
) -> Result<Option<Session>, String> {
    let site = platform_site(&platform)?;

    let Some(win) = app.get_webview_window(&format!("login-{platform}")) else {
        return Ok(None);
    };

    let cookies = win.cookies().map_err(|e| format!("쿠키 조회 실패: {e}"))?;

    let on_domain = |c: &tauri::webview::Cookie<'_>| {
        c.domain()
            .map(|d| d.trim_start_matches('.').ends_with(site.domain))
            .unwrap_or(false)
    };

    let found = match site.session_cookie {
        // 이름을 아는 플랫폼은 그 쿠키만 집는다.
        Some(name) => cookies
            .iter()
            .find(|c| on_domain(c) && c.name() == name)
            .map(|c| (c.name().to_string(), c.value().to_string())),
        // 모르는 플랫폼은 값이 충분히 긴 쿠키를 세션으로 추정한다.
        None => cookies
            .iter()
            .filter(|c| on_domain(c) && c.value().len() >= 16)
            .max_by_key(|c| c.value().len())
            .map(|c| (c.name().to_string(), c.value().to_string())),
    };

    let Some((name, value)) = found else {
        return Ok(None);
    };

    let masked = format!("{}…", value.chars().take(4).collect::<String>());
    let session = Session {
        platform: platform.clone(),
        name,
        value,
        masked,
    };

    *state.0.lock().unwrap() = Some(session.clone());
    Ok(Some(session))
}

/// 현재 보관 중인 세션 정보 (값 제외).
#[tauri::command]
fn current_session(state: tauri::State<'_, SessionState>) -> Option<Session> {
    state.0.lock().unwrap().clone()
}

#[tauri::command]
fn clear_session(state: tauri::State<'_, SessionState>) {
    *state.0.lock().unwrap() = None;
}

// ── 국내 노벨피아 직접 로그인 ───────────────────────────────
//
// 노벨피아는 공개 API 가 없다. 아래는 오픈소스 구현들에서 확인된
// 비공식 엔드포인트이며, 사이트가 개편되면 예고 없이 깨진다.
//
// LOGINKEY 는 서버가 주는 것이 아니라 클라이언트가 만들어 보내는 값이다.
// 로그인이 성공하면 서버가 그 값을 세션에 묶어 준다.
//
// 비밀번호는 이 요청에만 쓰고 어디에도 저장하지 않는다. 앱이 보관하는
// 것은 발급된 LOGINKEY 뿐이다.

const NOVELPIA_LOGIN_URL: &str = "https://novelpia.com/proc/login";

/// 노벨피아가 기대하는 형태의 LOGINKEY 를 만든다. (32자리 hex 두 개)
fn generate_loginkey() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let hex32 = |rng: &mut rand::rngs::ThreadRng| {
        (0..32)
            .map(|_| std::char::from_digit(rng.gen_range(0..16), 16).unwrap())
            .collect::<String>()
    };
    let a = hex32(&mut rng);
    let b = hex32(&mut rng);
    format!("{a}_{b}")
}

/// 이메일/비밀번호로 국내 노벨피아에 로그인한다.
///
/// 소셜(네이버·카카오) 계정은 이 경로로 로그인할 수 없다.
/// 그 경우 로그인 창(WebView)을 쓰고 capture_session 으로 세션을 가져온다.
#[tauri::command]
async fn novelpia_login(
    state: tauri::State<'_, SessionState>,
    email: String,
    password: String,
) -> Result<Session, String> {
    if email.trim().is_empty() || password.is_empty() {
        return Err("이메일과 비밀번호를 입력하세요.".into());
    }

    let loginkey = generate_loginkey();

    let client = reqwest::Client::builder()
        // 리다이렉트를 따라가면 판정용 본문을 놓친다.
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("HTTP 클라이언트 생성 실패: {e}"))?;

    let res = client
        .post(NOVELPIA_LOGIN_URL)
        .header("Cookie", format!("LOGINKEY={loginkey};"))
        .header(
            "User-Agent",
            "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) \
             AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        )
        .header("Referer", "https://novelpia.com/login/")
        .form(&[
            ("email", email.as_str()),
            ("wd", password.as_str()),
            ("redirectrurl", ""),
        ])
        .send()
        .await
        .map_err(|e| format!("노벨피아에 연결하지 못했습니다: {e}"))?;

    let status = res.status();
    let body = res
        .text()
        .await
        .map_err(|e| format!("응답을 읽지 못했습니다: {e}"))?;

    // 오픈소스 구현들이 쓰는 성공 판정. 사이트가 바뀌면 이 문자열도 바뀐다.
    if !body.contains("감사합니다") {
        // 서버가 이유를 알려주는 경우가 있어 앞부분을 함께 보여준다.
        let hint = body
            .chars()
            .filter(|c| !c.is_control())
            .take(120)
            .collect::<String>();
        return Err(if status.is_success() {
            format!("로그인에 실패했습니다. 이메일과 비밀번호를 확인하세요.\n서버 응답: {hint}")
        } else {
            format!("로그인에 실패했습니다 (HTTP {status}).\n서버 응답: {hint}")
        });
    }

    let masked = format!("{}…", loginkey.chars().take(4).collect::<String>());
    let session = Session {
        platform: "novelpia".into(),
        name: "LOGINKEY".into(),
        value: loginkey,
        masked,
    };

    *state.0.lock().unwrap() = Some(session.clone());
    Ok(session)
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

/// Codex 에 처음 건네는 지시.
///
/// Codex 는 AGENTS.md 를 자동으로 읽지만, 플랫폼 기준 문서는 스스로 찾지
/// 않는다. 어떤 플랫폼인지와 어느 파일을 읽어야 하는지 명시해 준다.
pub fn codex_briefing(platform: Option<&str>) -> String {
    let mut s = String::from(
        "이 저장소는 웹소설 장기 연재 프로젝트다. 작업을 시작하기 전에 다음을 읽어라.\n\n\
         1. AGENTS.md — 집필과 편집의 절대 규칙. 여기 적힌 것을 그대로 따른다.\n\
         2. PLATFORM.md — 대상 플랫폼과 분량 기준.\n",
    );

    match platform {
        Some("novelpia") => s.push_str(
            "3. reference/PLATFORM_GUIDE.md — 노벨피아 연재 기준 리서치 원문.\n\n\
             이 작품은 **노벨피아**에 연재한다.\n\
             분량은 노벨피아 집계 기준(공백과 마침표·따옴표·느낌표·물음표 제외) \
             3,300~4,200자를 목표로 한다. 집계 규칙이 공식적으로 완전히 공개되어 있지 \
             않으므로 기준선에 아슬아슬하게 맞추지 말고 여유를 둔다.\n",
        ),
        Some("joara") => s.push_str(
            "3. reference/PLATFORM_GUIDE.md — 조아라 연재 기준 리서치 원문.\n\n\
             이 작품은 **조아라**에 연재한다.\n\
             조아라는 글자 수가 아니라 KB 용량으로 분량을 센다. 회차당 10KB 이상, \
             평균 12KB 이상이 기준이다. 한글 1자를 2바이트로 보면 대략 5,000~6,000자다. \
             업로드 직전에 실제 용량을 반드시 확인한다.\n",
        ),
        _ => s.push_str(
            "\n대상 플랫폼이 아직 정해지지 않았다. \
             회차를 작성하기 전에 사용자에게 노벨피아인지 조아라인지 먼저 물어라. \
             두 플랫폼은 분량 산정 단위가 달라 임의로 추정하면 안 된다.\n",
        ),
    }

    s.push_str(
        "\n설정을 임의로 확정하지 마라. canon/ 이 비어 있으면 먼저 사용자와 함께 채운다.\n\
         준비되면 무엇부터 할지 물어라.",
    );

    s
}

// ── 내장 터미널 ─────────────────────────────────────────────
//
// Codex 는 전체 화면 TUI 라서 출력만 받아오면 쓸 수 없다. PTY 를 열어
// 앱 안의 xterm.js 와 연결한다.
//
// 셸을 거치지 않고 인자를 직접 넘기는 것이 중요하다. 예전에는
// `cmd /C start ... cmd /K "codex --flags "프롬프트""` 로 띄웠는데,
// 안쪽 따옴표가 먼저 닫혀 한국어 프롬프트가 토막나는 문제가 있었다.

struct Terminal {
    writer: Box<dyn std::io::Write + Send>,
    master: Box<dyn portable_pty::MasterPty + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
}

#[derive(Default)]
pub struct TerminalState(std::sync::Mutex<Option<Terminal>>);

/// vault 에서 Codex 를 PTY 로 띄운다. 출력은 `terminal:output` 이벤트로 흐른다.
#[tauri::command]
fn terminal_spawn(
    app: tauri::AppHandle,
    state: tauri::State<'_, TerminalState>,
    root: String,
    platform: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    use portable_pty::{CommandBuilder, PtySize};
    use tauri::Emitter;

    let dir = Path::new(&root)
        .canonicalize()
        .map_err(|e| format!("vault 경로를 찾을 수 없습니다: {e}"))?;
    if !dir.join("AGENTS.md").is_file() {
        return Err("AGENTS.md 가 없어 vault 로 보이지 않습니다".into());
    }

    // 이미 떠 있으면 정리하고 새로 띄운다.
    terminal_kill(state.clone())?;

    let pty = portable_pty::native_pty_system();
    let pair = pty
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("PTY 생성 실패: {e}"))?;

    let mut cmd = CommandBuilder::new(codex_command());
    cmd.arg(CODEX_FLAGS);
    // 브리핑을 인자로 그대로 넘긴다. 셸을 거치지 않으므로 따옴표 처리가 필요 없다.
    cmd.arg(codex_briefing(platform.as_deref()));
    cmd.cwd(&dir);

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Codex 실행 실패: {e}. PATH 에 codex 가 있는지 확인하세요."))?;

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("출력 연결 실패: {e}"))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("입력 연결 실패: {e}"))?;

    // 출력 펌프. 자식이 끝나면 스레드도 끝난다.
    let handle = app.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    // UTF-8 경계가 잘릴 수 있어 손실 허용 변환을 쓴다.
                    let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = handle.emit("terminal:output", chunk);
                }
                Err(_) => break,
            }
        }
        let _ = handle.emit("terminal:exit", ());
    });

    *state.0.lock().unwrap() = Some(Terminal {
        writer,
        master: pair.master,
        child,
    });

    Ok(())
}

/// 키 입력을 Codex 로 보낸다.
#[tauri::command]
fn terminal_write(state: tauri::State<'_, TerminalState>, data: String) -> Result<(), String> {
    let mut guard = state.0.lock().unwrap();
    let term = guard.as_mut().ok_or("터미널이 실행 중이 아닙니다")?;
    term.writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("입력 실패: {e}"))?;
    term.writer.flush().map_err(|e| format!("입력 실패: {e}"))
}

/// 창 크기 변경을 알린다. TUI 는 이걸 못 받으면 화면이 깨진다.
#[tauri::command]
fn terminal_resize(
    state: tauri::State<'_, TerminalState>,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let guard = state.0.lock().unwrap();
    let Some(term) = guard.as_ref() else {
        return Ok(());
    };
    term.master
        .resize(portable_pty::PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("크기 변경 실패: {e}"))
}

#[tauri::command]
fn terminal_kill(state: tauri::State<'_, TerminalState>) -> Result<(), String> {
    if let Some(mut term) = state.0.lock().unwrap().take() {
        let _ = term.child.kill();
        let _ = term.child.wait();
    }
    Ok(())
}

#[tauri::command]
fn terminal_running(state: tauri::State<'_, TerminalState>) -> bool {
    state.0.lock().unwrap().is_some()
}

use std::io::Read;


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .manage(TerminalState::default())
        .manage(SessionState::default())
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
            inspect_folder,
            init_vault,
            write_platform_guide,
            check_templates,
            upgrade_templates,
            codex_available,
            terminal_spawn,
            terminal_write,
            terminal_resize,
            terminal_kill,
            terminal_running,
            open_login_window,
            is_logged_in,
            capture_session,
            current_session,
            clear_session,
            novelpia_login
        ])
        .run(tauri::generate_context!())
        .expect("Story Vault 실행에 실패했습니다");
}

#[cfg(test)]
mod tests {
    use super::codex_briefing;

    #[test]
    fn 노벨피아는_글자수_기준을_알려준다() {
        let s = codex_briefing(Some("novelpia"));
        assert!(s.contains("노벨피아"));
        assert!(s.contains("3,300~4,200자"));
        // 조아라 기준이 섞이면 안 된다
        assert!(!s.contains("KB"));
    }

    #[test]
    fn 조아라는_KB_기준을_알려준다() {
        let s = codex_briefing(Some("joara"));
        assert!(s.contains("조아라"));
        assert!(s.contains("10KB"));
        // 노벨피아 목표치가 섞이면 안 된다
        assert!(!s.contains("3,300~4,200자"));
    }

    #[test]
    fn 미설정이면_먼저_물어보게_한다() {
        let s = codex_briefing(None);
        assert!(s.contains("먼저 물어라"));
        assert!(!s.contains("3,300"));
        assert!(!s.contains("10KB"));
    }

    #[test]
    fn 항상_agents_md_를_먼저_읽게_한다() {
        for p in [Some("novelpia"), Some("joara"), None] {
            assert!(codex_briefing(p).contains("AGENTS.md"));
        }
    }

    #[test]
    fn 설정을_임의로_확정하지_말라고_지시한다() {
        assert!(codex_briefing(Some("novelpia")).contains("임의로 확정하지 마라"));
    }
}
