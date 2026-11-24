import { Body, Controller, Get, Header, HttpCode, Post } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  markNotificationsReadInputSchema,
  markNotificationsReadResultSchema,
  type NotificationList,
  notificationListSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { openApiSchema } from '../../common/openapi.js';
import { CurrentActor } from '../auth/auth.decorators.js';
import { NotificationsService } from './notifications.service.js';

/** Notifications du compte connecté, et de lui seul (aucun identifiant de destinataire, D192). */
@ApiTags('Notifications')
@ApiCookieAuth()
@Controller('me/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Lister ses notifications non lues' })
  @ApiOkResponse({ schema: openApiSchema(notificationListSchema) })
  list(@CurrentActor() actor: Actor): Promise<NotificationList> {
    return this.notifications.listMine(actor);
  }

  @Post('read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Marquer des notifications comme lues' })
  @ApiBody({ schema: openApiSchema(markNotificationsReadInputSchema, 'input') })
  @ApiOkResponse({ schema: openApiSchema(markNotificationsReadResultSchema) })
  markRead(@CurrentActor() actor: Actor, @Body() body: unknown): Promise<{ updated: number }> {
    return this.notifications.markRead(actor, body);
  }
}
