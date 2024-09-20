import { hexToBytes, randomBytes } from '@noble/hashes/utils'
import { cbc } from '@noble/ciphers/aes'
import { base64 } from '@scure/base'
import { utf8Decoder, utf8Encoder } from 'nostr-tools/utils'


export async function groupEncrypt(groupPrivKey:string | Uint8Array, text: string): Promise<string> {
    const privkey: Uint8Array = groupPrivKey instanceof Uint8Array ? groupPrivKey : hexToBytes(groupPrivKey)
    const iv = Uint8Array.from(randomBytes(16))
    const plaintext = utf8Encoder.encode(text)
    const ciphertext = cbc(privkey, iv).encrypt(plaintext)
    const ctb64 = base64.encode(new Uint8Array(ciphertext))
    const ivb64 = base64.encode(new Uint8Array(iv.buffer))
    return `${ctb64}?iv=${ivb64}`
}

export async function groupDecrypt(groupPrivKey:string | Uint8Array, data: string): Promise<string> {
    const privkey: Uint8Array = groupPrivKey instanceof Uint8Array ? groupPrivKey : hexToBytes(groupPrivKey)
    const [ctb64, ivb64] = data.split('?iv=')
    const iv = base64.decode(ivb64)
    const ciphertext = base64.decode(ctb64)
    const plaintext = cbc(privkey, iv).decrypt(ciphertext)
    return utf8Decoder.decode(plaintext)
}