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

const ROOT_KEY = 'story-vault:root'

export const loadSavedRoot = () => localStorage.getItem(ROOT_KEY)
export const saveRoot = (root: string) => localStorage.setItem(ROOT_KEY, root)
