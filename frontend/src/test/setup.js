import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

class MemoryStorage {
  constructor() {
    this.store = new Map()
  }
  getItem(key) {
    return this.store.has(String(key)) ? this.store.get(String(key)) : null
  }
  setItem(key, value) {
    this.store.set(String(key), String(value))
  }
  removeItem(key) {
    this.store.delete(String(key))
  }
  clear() {
    this.store.clear()
  }
  get length() {
    return this.store.size
  }
  key(index) {
    return Array.from(this.store.keys())[index] || null
  }
}

const memoryStorage = new MemoryStorage()

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  enumerable: true,
  writable: true,
  value: memoryStorage,
})

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: memoryStorage,
  })
}

afterEach(() => {
  cleanup()
  globalThis.localStorage.clear()
})
