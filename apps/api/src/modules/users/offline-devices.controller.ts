import { Body, Controller, Get, Header, HttpCode, Param, Post, Req } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  OFFLINE_DEVICE_MAX_ACTIVE,
  type OfflineDeviceKey,
  offlineDeviceKeySchema,
  type OfflineDeviceList,
  offlineDeviceListSchema,
  registerOfflineDeviceInputSchema,
} from '@tesla/shared';
import { openApiSchema } from '../../common/openapi.js';
import { parseId } from '../../common/validation.js';
import { type AuthenticatedRequest } from '../auth/auth.decorators.js';
import { OfflineDevicesService } from './offline-devices.service.js';

/** Appareils préparés pour l'usage hors connexion du titulaire (D180). Session obligatoire. */
@ApiTags('Authentification')
@ApiCookieAuth()
@Controller('auth/offline-devices')
export class OfflineDevicesController {
  constructor(private readonly devices: OfflineDevicesService) {}

  @Get()
  @ApiOperation({ summary: 'Mes appareils préparés pour l’usage hors connexion' })
  @ApiOkResponse({ schema: openApiSchema(offlineDeviceListSchema) })
  list(@Req() request: AuthenticatedRequest): Promise<OfflineDeviceList> {
    return this.devices.list(request.actor!.userId);
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Préparer cet appareil (clé d’appareil remise une fois)',
    description: `Au plus ${OFFLINE_DEVICE_MAX_ACTIVE} appareils actifs par compte (409 OFFLINE_DEVICE_LIMIT).`,
  })
  @ApiBody({ schema: openApiSchema(registerOfflineDeviceInputSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(offlineDeviceKeySchema) })
  register(@Body() body: unknown, @Req() request: AuthenticatedRequest): Promise<OfflineDeviceKey> {
    return this.devices.register(request.actor!.userId, body);
  }

  @Post(':id/key')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Clé d’un appareil actif (reprotection du coffre après changement de mot de passe)',
    description: '404 OFFLINE_DEVICE_NOT_FOUND, 410 OFFLINE_DEVICE_REVOKED.',
  })
  @ApiOkResponse({ schema: openApiSchema(offlineDeviceKeySchema) })
  key(@Param('id') id: string, @Req() request: AuthenticatedRequest): Promise<OfflineDeviceKey> {
    return this.devices.key(request.actor!.userId, parseId(id));
  }

  @Post(':id/revoke')
  @HttpCode(204)
  @ApiOperation({ summary: 'Retirer un appareil (perdu, prêté, remplacé)' })
  @ApiNoContentResponse()
  revoke(@Param('id') id: string, @Req() request: AuthenticatedRequest): Promise<void> {
    return this.devices.revoke(request.actor!.userId, parseId(id));
  }
}
