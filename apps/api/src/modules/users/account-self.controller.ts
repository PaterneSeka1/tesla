import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
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
  completeAccountCredentialInputSchema,
  completeAccountTokenInputSchema,
  passwordResetRequestInputSchema,
  type PasswordResetRequestResult,
  passwordResetRequestResultSchema,
  type RevokedSessions,
  revokedSessionsSchema,
  type SessionList,
  sessionListSchema,
  type MyProfile,
  myProfileSchema,
  verifyAccountCredentialInputSchema,
} from '@tesla/shared';
import { openApiSchema } from '../../common/openapi.js';
import { parseId } from '../../common/validation.js';
import { type AuthenticatedRequest, Public } from '../auth/auth.decorators.js';
import { AuthService } from '../auth/auth.service.js';
import { AccountSelfService } from './account-self.service.js';
import { AccountsService } from './accounts.service.js';

/**
 * Adresse IP du client telle qu'établie par Express : derrière Nginx (`TRUST_PROXY=true`), le
 * dernier saut ajouté par le proxy de confiance, jamais un `X-Forwarded-For` fourni par le client.
 */
function clientIp(request: AuthenticatedRequest): string {
  return request.ip ?? 'inconnue';
}

/** Routes du compte personnel et des liens d'activation, sous `/auth` (jamais conservées hors ligne). */
@ApiTags('Authentification')
@Controller('auth')
export class AccountSelfController {
  constructor(
    private readonly self: AccountSelfService,
    private readonly accounts: AccountsService,
    private readonly auth: AuthService,
  ) {}

  // ─── Inscription privée sur invitation (D162) ────────────────────────────

  @Public()
  @Post('activation/verify')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Vérifier une invitation (lien ou e-mail et code) sans la consommer',
  })
  @ApiBody({ schema: openApiSchema(verifyAccountCredentialInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(accountTokenInfoSchema) })
  @ApiBadRequestResponse({ description: 'INVALID_ACCOUNT_LINK ou INVALID_ACCOUNT_CODE' })
  @ApiTooManyRequestsResponse({ description: 'TOO_MANY_LOGIN_ATTEMPTS (Retry-After)' })
  verifyActivation(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<AccountTokenInfo> {
    return this.accounts.verifyCredential(body, clientIp(request), 'ACTIVATION');
  }

  @Public()
  @Post('activation/complete')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Activer son compte en choisissant son mot de passe',
    description:
      'L’invitation est revérifiée et consommée atomiquement ; le compte reste lié à sa fiche.',
  })
  @ApiBody({ schema: openApiSchema(completeAccountCredentialInputSchema, 'input') })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({
    description: 'INVALID_ACCOUNT_LINK, INVALID_ACCOUNT_CODE ou VALIDATION_ERROR',
  })
  completeActivation(@Body() body: unknown, @Req() request: AuthenticatedRequest): Promise<void> {
    return this.accounts.completeCredential(body, clientIp(request), 'ACTIVATION');
  }

  // ─── Mot de passe oublié (D166) ──────────────────────────────────────────

  @Public()
  @Post('password-reset/request')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Demander un nouveau mot de passe (réponse neutre)',
    description:
      'Même réponse que le compte existe ou non. `channel` : EMAIL si l’envoi est configuré, RESPONSABLE sinon (rien n’est envoyé).',
  })
  @ApiBody({ schema: openApiSchema(passwordResetRequestInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(passwordResetRequestResultSchema) })
  @ApiTooManyRequestsResponse({ description: 'TOO_MANY_LOGIN_ATTEMPTS (Retry-After)' })
  requestPasswordReset(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<PasswordResetRequestResult> {
    return this.accounts.requestPasswordReset(body, clientIp(request));
  }

  @Public()
  @Post('password-reset/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Vérifier une demande de récupération (lien ou e-mail et code)' })
  @ApiBody({ schema: openApiSchema(verifyAccountCredentialInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(accountTokenInfoSchema) })
  @ApiBadRequestResponse({ description: 'INVALID_ACCOUNT_LINK ou INVALID_ACCOUNT_CODE' })
  @ApiTooManyRequestsResponse({ description: 'TOO_MANY_LOGIN_ATTEMPTS (Retry-After)' })
  verifyPasswordReset(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<AccountTokenInfo> {
    return this.accounts.verifyCredential(body, clientIp(request), 'REINITIALISATION');
  }

  @Public()
  @Post('password-reset/complete')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Choisir un nouveau mot de passe',
    description: 'Consomme la demande et ferme toutes les sessions du compte.',
  })
  @ApiBody({ schema: openApiSchema(completeAccountCredentialInputSchema, 'input') })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({
    description: 'INVALID_ACCOUNT_LINK, INVALID_ACCOUNT_CODE ou VALIDATION_ERROR',
  })
  completePasswordReset(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.accounts.completeCredential(body, clientIp(request), 'REINITIALISATION');
  }

  // ─── Anciennes routes (liens `/activation#…` déjà émis) ─────────────────

  @Public()
  @Post('account-link/inspect')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Vérifier un lien d’activation ou de réinitialisation (ancienne route)',
    deprecated: true,
  })
  @ApiBody({ schema: openApiSchema(accountTokenInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(accountTokenInfoSchema) })
  @ApiBadRequestResponse({ description: 'INVALID_ACCOUNT_LINK' })
  @ApiTooManyRequestsResponse({ description: 'TOO_MANY_LOGIN_ATTEMPTS' })
  inspectLink(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<AccountTokenInfo> {
    return this.accounts.inspectToken(body, clientIp(request));
  }

  @Public()
  @Post('account-link/complete')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Définir son mot de passe avec un lien à usage unique (ancienne route)',
    description: 'Consomme le lien et ferme toutes les sessions du compte.',
    deprecated: true,
  })
  @ApiBody({ schema: openApiSchema(completeAccountTokenInputSchema, 'input') })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'INVALID_ACCOUNT_LINK ou VALIDATION_ERROR' })
  completeLink(@Body() body: unknown, @Req() request: AuthenticatedRequest): Promise<void> {
    return this.accounts.completeToken(body, clientIp(request));
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

  @Get('profile')
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Mon profil (lecture seule)',
    description:
      'Identité et données administratives gérées par l’administration ; âge, ancienneté, étape et échéances calculés par l’API (D173). Aucune modification par le titulaire.',
  })
  @ApiOkResponse({ schema: openApiSchema(myProfileSchema) })
  profile(@Req() request: AuthenticatedRequest): Promise<MyProfile> {
    return this.self.profile(request.actor!);
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
