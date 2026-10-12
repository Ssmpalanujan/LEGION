import { describe, it, expect } from 'vitest'
import { encryptText, decryptText, looksEncrypted } from './crypto'

describe('password protection (AES-GCM)', () => {
  it('encrypts and decrypts with the right password', async () => {
    const plain = '<h1>Secret</h1><p>Top-secret content ✓</p>'
    const env = await encryptText(plain, 'correct-horse')
    expect(looksEncrypted(env)).toBe(true)
    expect(await decryptText(env, 'correct-horse')).toBe(plain)
  })

  it('fails with the wrong password', async () => {
    const env = await encryptText('data', 'right')
    await expect(decryptText(env, 'wrong')).rejects.toThrow()
  })

  it('ciphertexts differ for identical plaintext (random salt/iv)', async () => {
    const a = await encryptText('same', 'pw')
    const b = await encryptText('same', 'pw')
    expect(a).not.toBe(b)
  })

  it('rejects empty password and non-envelopes', async () => {
    await expect(encryptText('x', '')).rejects.toThrow()
    expect(looksEncrypted('<p>plain html</p>')).toBe(false)
    await expect(decryptText('<p>nope</p>', 'pw')).rejects.toThrow()
  })
})
