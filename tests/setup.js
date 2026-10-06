import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { beforeEach, afterEach, vi } from 'vitest'
import { clearToken } from '../src/lib/helpers/session.js'

beforeEach(() => {
  // Application unit tests must explicitly mock every transport boundary.
  vi.stubGlobal('fetch', () => { throw new Error('Unmocked fetch is forbidden in offline unit tests') })
  vi.stubGlobal('WebSocket', class OfflineWebSocket {
    static OPEN = 1
    constructor() { throw new Error('Unmocked WebSocket is forbidden in offline unit tests') }
  })
})

afterEach(() => {
  cleanup()
  clearToken()
  window.localStorage.clear()
  vi.unstubAllGlobals()
})

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
}

if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}
