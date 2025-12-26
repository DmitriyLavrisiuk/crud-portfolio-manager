import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createDecipheriv, createCipheriv, randomBytes } from 'node:crypto'

export type EncryptedString = {
  v: number
  iv: string
  tag: string
  data: string
}

@Injectable()
export class EncryptionService {
  private readonly key: Buffer

  constructor(configService: ConfigService) {
    const keyHex = configService.get<string>('MASTER_KEY_HEX')
    if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
      throw new Error('MASTER_KEY_HEX must be set to a 64-character hex string')
    }
    this.key = Buffer.from(keyHex, 'hex')
  }

  encrypt(value: string, userId: string): EncryptedString {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    cipher.setAAD(Buffer.from(`user:${userId}`))
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ])
    const tag = cipher.getAuthTag()

    return {
      v: 1,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      data: encrypted.toString('base64'),
    }
  }

  decrypt(payload: EncryptedString, userId: string): string {
    if (payload.v !== 1) {
      throw new Error('Unsupported key version')
    }
    const iv = Buffer.from(payload.iv, 'base64')
    const tag = Buffer.from(payload.tag, 'base64')
    const data = Buffer.from(payload.data, 'base64')
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv)
    decipher.setAAD(Buffer.from(`user:${userId}`))
    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
    return decrypted.toString('utf8')
  }
}
