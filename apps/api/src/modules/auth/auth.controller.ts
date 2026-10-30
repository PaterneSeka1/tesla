import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import {
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  loginInputSchema,
  type MeResponse,
  meResponseSchema,
  SESSION_COOKIE_NAME,
} from '@tesla/shared';
import { type CookieOptions, type Response } from 'express';
import { openApiSchema } from '../../common/openapi.js';
import { ENV } from '../../config/config.module.js';
import { type Env } from '../../config/env.js';
import { type AuthenticatedRequest, Public } from './auth.decorators.js';
import { AuthService } from './auth.service.js';
import { readCookie } from './session-token.js';

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Cookie httpOnly, SameSite=Lax, Secure en production. */
  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.env.NODE_ENV === 'production',
      path: '/',
    };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Connexion par e-mail et mot de passe (pose le cookie de session)' })
  @ApiBody({ schema: openApiSchema(loginInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(meResponseSchema) })
  @ApiUnauthorizedResponse({ description: 'INVALID_CREDENTIALS' })
  @ApiTooManyRequestsResponse({ description: 'TOO_MANY_LOGIN_ATTEMPTS' })
  async login(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MeResponse> {
    const { token, expiresAt, user } = await this.auth.login(body, {
      ip: request.ip ?? 'inconnue',
      userAgent: request.headers['user-agent'],
    });
    response.cookie(SESSION_COOKIE_NAME, token, { ...this.cookieOptions(), expires: expiresAt });
    return { user };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Déconnexion : révoque la session et efface le cookie' })
  @ApiNoContentResponse()
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = readCookie(request.headers.cookie, SESSION_COOKIE_NAME);
    if (token) await this.auth.logout(token);
    response.clearCookie(SESSION_COOKIE_NAME, this.cookieOptions());
  }

  @Get('me')
  @ApiOperation({ summary: 'Utilisateur connecté' })
  @ApiOkResponse({ schema: openApiSchema(meResponseSchema) })
  @ApiUnauthorizedResponse({ description: 'UNAUTHENTICATED' })
  async me(@Req() request: AuthenticatedRequest): Promise<MeResponse> {
    const user = request.sessionUser!;
    return {
      user: { ...user, authorityValidUntil: await this.auth.authorityValidUntil(user.id) },
    };
  }
}
