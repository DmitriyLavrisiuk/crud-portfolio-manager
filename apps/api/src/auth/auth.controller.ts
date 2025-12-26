import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import { Response, Request } from 'express'

import { ZodValidationPipe } from '../common/zod-validation.pipe'
import { AuthService } from './auth.service'
import { authCredentialsSchema } from './dto/auth.schemas'
import { JwtAuthGuard } from './jwt-auth.guard'

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(
    @Body(new ZodValidationPipe(authCredentialsSchema))
    body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(body.email, body.password)
    this.setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt)
    return { user: result.user, accessToken: result.accessToken }
  }

  @Post('login')
  async login(
    @Body(new ZodValidationPipe(authCredentialsSchema))
    body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(body.email, body.password)
    this.setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt)
    return { user: result.user, accessToken: result.accessToken }
  }

  @Get('session')
  async session(@Req() req: Request) {
    const refreshToken = req.cookies?.[this.authService.getRefreshCookieName()]
    return this.authService.getSession(refreshToken)
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[this.authService.getRefreshCookieName()]
    const result = await this.authService.refresh(refreshToken)
    this.setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt)
    return { user: result.user, accessToken: result.accessToken }
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[this.authService.getRefreshCookieName()]
    const result = await this.authService.logout(refreshToken)
    res.clearCookie(
      this.authService.getRefreshCookieName(),
      this.authService.getRefreshCookieOptions(),
    )
    return result
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request) {
    const user = req.user as { sub: string; email: string; role: string }
    return { user: { id: user.sub, email: user.email, role: user.role } }
  }

  private setRefreshCookie(
    res: Response,
    refreshToken: string,
    refreshExpiresAt: Date,
  ) {
    const maxAge = Math.max(refreshExpiresAt.getTime() - Date.now(), 0)
    res.cookie(this.authService.getRefreshCookieName(), refreshToken, {
      ...this.authService.getRefreshCookieOptions(),
      maxAge,
    })
  }
}
