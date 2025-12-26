import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import * as argon2 from 'argon2'
import { createHash } from 'node:crypto'
import { Types } from 'mongoose'

import { RefreshTokensService } from '../refresh-tokens/refresh-tokens.service'
import { UsersService } from '../users/users.service'
import { type UserDocument } from '../users/schemas/user.schema'

const REFRESH_TOKEN_NAME = 'refresh_token'

export type AuthUser = {
  id: string
  email: string
  role: 'user' | 'admin'
  createdAt?: Date
  updatedAt?: Date
}

type Tokens = {
  accessToken: string
  refreshToken: string
  refreshExpiresAt: Date
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private refreshTokensService: RefreshTokensService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(email: string, password: string) {
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    })
    const user = await this.usersService.createUser({ email, passwordHash })
    const tokens = await this.issueTokens(user)
    await this.storeRefreshToken(
      user._id,
      tokens.refreshToken,
      tokens.refreshExpiresAt,
    )
    return {
      user: this.toAuthUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      refreshExpiresAt: tokens.refreshExpiresAt,
    }
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email)
    if (!user) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const isValid = await argon2.verify(user.passwordHash, password)
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const tokens = await this.issueTokens(user)
    await this.storeRefreshToken(
      user._id,
      tokens.refreshToken,
      tokens.refreshExpiresAt,
    )
    return {
      user: this.toAuthUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      refreshExpiresAt: tokens.refreshExpiresAt,
    }
  }

  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken)
    const tokenHash = this.hashToken(refreshToken)

    const stored = await this.refreshTokensService.findByHash(tokenHash)
    if (!stored || stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid refresh token')
    }

    await this.refreshTokensService.deleteByHash(tokenHash)

    const user = await this.usersService.findById(payload.sub)
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token')
    }

    const tokens = await this.issueTokens(user)
    await this.storeRefreshToken(
      user._id,
      tokens.refreshToken,
      tokens.refreshExpiresAt,
    )
    return {
      user: this.toAuthUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      refreshExpiresAt: tokens.refreshExpiresAt,
    }
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) {
      return { ok: true }
    }
    const tokenHash = this.hashToken(refreshToken)
    await this.refreshTokensService.deleteByHash(tokenHash)
    return { ok: true }
  }

  async getSession(refreshToken: string | undefined) {
    if (!refreshToken) {
      return { authenticated: false }
    }
    try {
      const payload = await this.verifyRefreshToken(refreshToken)
      const tokenHash = this.hashToken(refreshToken)

      const stored = await this.refreshTokensService.findByHash(tokenHash)
      if (!stored || stored.expiresAt.getTime() < Date.now()) {
        return { authenticated: false }
      }

      const user = await this.usersService.findById(payload.sub)
      if (!user) {
        return { authenticated: false }
      }

      return { authenticated: true, user: this.toAuthUser(user) }
    } catch {
      return { authenticated: false }
    }
  }

  getRefreshCookieName() {
    return REFRESH_TOKEN_NAME
  }

  getRefreshCookieOptions() {
    const secure = this.configService.get('COOKIE_SECURE') === 'true'
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure,
      path: '/',
    }
  }

  private async issueTokens(user: UserDocument): Promise<Tokens> {
    const accessToken = await this.jwtService.signAsync(
      { sub: user._id.toString(), email: user.email, role: user.role },
      {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>('JWT_ACCESS_TTL'),
      },
    )

    const refreshToken = await this.jwtService.signAsync(
      { sub: user._id.toString(), email: user.email },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_TTL'),
      },
    )

    const refreshExpiresAt = this.calculateExpiresAt(
      this.configService.get<string>('JWT_REFRESH_TTL'),
    )

    return { accessToken, refreshToken, refreshExpiresAt }
  }

  private async storeRefreshToken(
    userId: Types.ObjectId,
    refreshToken: string,
    refreshExpiresAt: Date,
  ) {
    const tokenHash = this.hashToken(refreshToken)
    await this.refreshTokensService.create({
      userId,
      tokenHash,
      expiresAt: refreshExpiresAt,
    })
  }

  private async verifyRefreshToken(refreshToken: string) {
    try {
      return await this.jwtService.verifyAsync<{ sub: string; email: string }>(
        refreshToken,
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        },
      )
    } catch {
      throw new UnauthorizedException('Invalid refresh token')
    }
  }

  private calculateExpiresAt(ttl?: string) {
    const ttlMs = this.parseDurationToMs(ttl ?? '7d')
    return new Date(Date.now() + ttlMs)
  }

  private parseDurationToMs(input: string) {
    const match = input.match(/^(\d+)([smhd])$/)
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000
    }
    const value = Number(match[1])
    const unit = match[2]
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    }
    return value * multipliers[unit]
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex')
  }

  private toAuthUser(user: UserDocument): AuthUser {
    return {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  }
}
