import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import {
  type AccountTokenInfo,
  accountTokenInfoSchema,
  accountTokenInputSchema,
  changePasswordInputSchema,
  completeAccountTokenInputSchema,
  type MeResponse,
  meResponseSchema,
  type RevokedSessions,
  revokedSessionsSchema,
  type SessionList,
  sessionListSchema,
  updateProfileInputSchema,
} from '@tesla/shared';
import { openApiSchema } from '../../common/openapi.js';
import { parseId } from '../../common/validation.js';
import { type AuthenticatedRequest, Public } from '../auth/auth.decorators.js';
import { AuthService } from '../auth/auth.service.js';
import { AccountSelfService } from './account-self.service.js';
import { AccountsService } from './accounts.service.js';

/** Routes du compte personnel et des liens d'activation, sous `/auth` (jamais conservées hors ligne). */
@ApiTags('Authentification')
@Controller('auth')
export class AccountSelfController {
  constructor(
    private readonly self: AccountSelfService,
    private readonly accounts: AccountsService,
    private readonly auth: AuthService,
  ) {}

  @Public()
  @Post('account-link/inspect')
  @HttpCode(200)
  @ApiOperation({ summary: 'Vérifier un lien d’activation ou de réinitialisation' })
  @ApiBody({ schema: openApiSchema(accountTokenInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(accountTokenInfoSchema) })
  @ApiBadRequestResponse({ description: 'INVALID_ACCOUNT_LINK' })
  @ApiTooManyRequestsResponse({ description: 'TOO_MANY_LOGIN_ATTEMPTS' })
  inspectLink(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<AccountTokenInfo> {
    return this.accounts.inspectToken(body, request.ip ?? 'inconnue');
  }

  @Public()
  @Post('account-link/complete')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Définir son mot de passe avec un lien à usage unique',
    description: 'Consomme le lien et ferme toutes les sessions du compte.',
  })
  @ApiBody({ schema: openApiSchema(completeAccountTokenInputSchema, 'input') })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'INVALID_ACCOUNT_LINK ou VALIDATION_ERROR' })
  completeLink(@Body() body: unknown, @Req() request: AuthenticatedRequest): Promise<void> {
    return this.accounts.completeToken(body, request.ip ?? 'inconnue');
  }

  @Post('password')
  @HttpCode(204)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Changer son mot de passe',
    description: 'Les autres sessions sont fermées ; la session courante reste ouverte.',
  })
  @ApiBody({ schema: openApiSchema(changePasswordInputSchema, 'input') })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'INVALID_CURRENT_PASSWORD ou VALIDATION_ERROR' })
  changePassword(@Body() body: unknown, @Req() request: AuthenticatedRequest): Promise<void> {
    return this.self.changePassword(request.actor!.userId, request.sessionId!, body);
  }

  @Patch('profile')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Modifier son nom affiché' })
  @ApiBody({ schema: openApiSchema(updateProfileInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(meResponseSchema) })
  async updateProfile(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<MeResponse> {
    const userId = request.actor!.userId;
    await this.self.updateProfile(userId, body);
    return {
      user: {
        ...(await this.auth.currentUser(userId)),
        authorityValidUntil: await this.auth.authorityValidUntil(userId),
      },
    };
  }

  @Get('sessions')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Sessions ouvertes de son compte' })
  @ApiOkResponse({ schema: openApiSchema(sessionListSchema) })
  sessions(@Req() request: AuthenticatedRequest): Promise<SessionList> {
    return this.self.listSessions(request.actor!.userId, request.sessionId!);
  }

  @Post('sessions/revoke-others')
  @HttpCode(200)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Fermer ses autres sessions' })
  @ApiOkResponse({ schema: openApiSchema(revokedSessionsSchema) })
  revokeOthers(@Req() request: AuthenticatedRequest): Promise<RevokedSessions> {
    return this.self.revokeOtherSessions(request.actor!.userId, request.sessionId!);
  }

  @Post('sessions/:id/revoke')
  @HttpCode(204)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Fermer une de ses sessions' })
  @ApiNoContentResponse()
  revokeSession(@Param('id') id: string, @Req() request: AuthenticatedRequest): Promise<void> {
    return this.self.revokeSession(request.actor!.userId, parseId(id));
  }
}
