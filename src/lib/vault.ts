import { invoke } from '@tauri-apps/api/core'

export interface Entry {
  path: string
  name: string
  is_dir: boolean
  children: Entry[]
}

export const listTree = (root: string) => invoke<Entry[]>('list_tree', { root })

export const readFile = (root: string, path: string) =>
  invoke<string>('read_file', { root, path })

export const writeFile = (root: string, path: string, contents: string) =>
  invoke<void>('write_file', { root, path, contents })

export const isVault = (root: string) => invoke<boolean>('is_vault', { root })

/** 선택한 폴더에서 실제 vault 루트를 찾는다. 못 찾으면 null. */
export const findVaultRoot = (picked: string) =>
  invoke<string | null>('find_vault_root', { picked })

export interface VaultCandidate {
  is_vault: boolean
  is_empty: boolean
  existing: string[]
}

/** 폴더가 새 vault를 만들기에 적합한지 살펴본다. */
export const inspectFolder = (path: string) =>
  invoke<VaultCandidate>('inspect_folder', { path })

/** 폴더에 새 vault 구조를 만든다. 실제 vault 루트 경로를 돌려준다. */
export const initVault = (path: string) => invoke<string>('init_vault', { path })

/** Codex CLI가 설치되어 있는지. */
export const codexAvailable = () => invoke<boolean>('codex_available')

/** vault 디렉터리에서 Codex를 새 터미널 창으로 실행한다. */
export const launchCodex = (root: string, platform: string | null) =>
  invoke<void>('launch_codex', { root, platform })

export interface TemplateStatus {
  vault_version: number
  app_version: number
  /** 최신 템플릿과 내용이 다른 관리 파일 */
  outdated: string[]
  /** 그중 사용자가 손댄 것으로 보이는 파일 */
  modified: string[]
}

/** 앱이 관리하는 파일(집필 규칙·명령 템플릿)이 최신인지 확인한다. */
export const checkTemplates = (root: string) =>
  invoke<TemplateStatus>('check_templates', { root })

/** 관리 파일을 최신으로 갱신한다. 기존 내용은 archive/ 에 백업된다. */
export const upgradeTemplates = (root: string, files: string[]) =>
  invoke<string[]>('upgrade_templates', { root, files })

/** 선택한 플랫폼의 기준 문서를 vault/reference/ 에 써넣는다. */
export const writePlatformGuide = (root: string, platform: string) =>
  invoke<void>('write_platform_guide', { root, platform })

/** 플랫폼 로그인 창을 연다. 로그인은 사용자가 직접 수행한다. */
export const openLoginWindow = (platform: string) =>
  invoke<void>('open_login_window', { platform })

/** 해당 플랫폼의 세션 쿠키가 있는지. */
export const isLoggedIn = (platform: string) => invoke<boolean>('is_logged_in', { platform })

const ROOT_KEY = 'story-vault:root'

export const loadSavedRoot = () => localStorage.getItem(ROOT_KEY)
export const saveRoot = (root: string) => localStorage.setItem(ROOT_KEY, root)
