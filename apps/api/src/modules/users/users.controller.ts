import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  type Account,
  type AccountListQuery,
  accountSchema,
  type AccountWithLink,
  accountWithLinkSchema,
  createAccountInputSchema,
  deactivateAccountInputSchema,
  type Paginated,
  paginatedSchema,
  type RevokedSessions,
  revokedSessionsSchema,
  updateAccountInputSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { openApiSchema } from '../../common/openapi.js';
import { parseId } from '../../common/validation.js';
import { CurrentActor } from '../auth/auth.decorators.js';
import { AccountsService } from './accounts.service.js';

@ApiTags('Comptes')
@ApiCookieAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les comptes du périmètre de l’acteur' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'role', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOkResponse({ schema: openApiSchema(paginatedSchema(accountSchema)) })
  list(
    @CurrentActor() actor: Actor,
    @Query() query: AccountListQuery,
  ): Promise<Paginated<Account>> {
    return this.accounts.list(actor, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Créer un compte et son lien d’activation',
    description:
      'Le lien n’est renvoyé qu’une fois ; il se transmet au titulaire hors application.',
  })
  @ApiBody({ schema: openApiSchema(createAccountInputSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(accountWithLinkSchema) })
  create(@CurrentActor() actor: Actor, @Body() body: unknown): Promise<AccountWithLink> {
    return this.accounts.create(actor, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Compte' })
  @ApiOkResponse({ schema: openApiSchema(accountSchema) })
  get(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<Account> {
    return this.accounts.get(actor, parseId(id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier l’adresse e-mail ou le nom' })
  @ApiBody({ schema: openApiSchema(updateAccountInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(accountSchema) })
  update(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<Account> {
    return this.accounts.update(actor, parseId(id), body);
  }

  @Post(':id/link')
  @ApiOperation({ summary: 'Émettre un nouveau lien (activation ou réinitialisation)' })
  @ApiCreatedResponse({ schema: openApiSchema(accountWithLinkSchema) })
  issueLink(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<AccountWithLink> {
    return this.accounts.issueAccountLink(actor, parseId(id));
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Désactiver un compte (sessions et liens révoqués)' })
  @ApiBody({ schema: openApiSchema(deactivateAccountInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(accountSchema) })
  deactivate(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<Account> {
    return this.accounts.deactivate(actor, parseId(id), body);
  }

  @Post(':id/reactivate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Réactiver un compte' })
  @ApiOkResponse({ schema: openApiSchema(accountSchema) })
  reactivate(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<Account> {
    return this.accounts.reactivate(actor, parseId(id));
  }

  @Post(':id/revoke-sessions')
  @HttpCode(200)
  @ApiOperation({ summary: 'Fermer toutes les sessions du compte' })
  @ApiOkResponse({ schema: openApiSchema(revokedSessionsSchema) })
  revokeSessions(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<RevokedSessions> {
    return this.accounts.revokeSessions(actor, parseId(id));
  }
}
