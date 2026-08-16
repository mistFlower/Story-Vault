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

/** Codex CLI가 설치되어 있는지. */
export const codexAvailable = () => invoke<boolean>('codex_available')

/** vault 디렉터리에서 Codex를 새 터미널 창으로 실행한다. */
export const launchCodex = (root: string) => invoke<void>('launch_codex', { root })

const ROOT_KEY = 'story-vault:root'

export const loadSavedRoot = () => localStorage.getItem(ROOT_KEY)
export const saveRoot = (root: string) => localStorage.setItem(ROOT_KEY, root)
