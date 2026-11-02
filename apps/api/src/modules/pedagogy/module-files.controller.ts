import { Body, Controller, Get, HttpCode, Param, Post, Res } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { type Response } from 'express';
import {
  type RequestModuleFileUploadInput,
  requestModuleFileUploadInputSchema,
  type StoredFile,
  storedFileSchema,
  type UploadTicket,
  uploadTicketSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { openApiSchema } from '../../common/openapi.js';
import { parseId } from '../../common/validation.js';
import { CurrentActor } from '../auth/auth.decorators.js';
import { ModuleFilesService } from './module-files.service.js';

@ApiTags('Fichiers des modules')
@ApiCookieAuth()
@Controller()
export class ModuleFilesController {
  constructor(private readonly files: ModuleFilesService) {}

  @Post('editor/modules/:id/files')
  @ApiOperation({
    summary: 'Autoriser l’envoi direct d’un fichier (image ou PDF) vers le stockage',
    description:
      'Renvoie une URL signée à usage unique (type, taille signés ; aucun écrasement). Le fichier ' +
      'n’est utilisable qu’après confirmation et vérification par le serveur.',
  })
  @ApiBody({ schema: openApiSchema(requestModuleFileUploadInputSchema, 'input') })
  @ApiCreatedResponse({ schema: openApiSchema(uploadTicketSchema) })
  requestUpload(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: RequestModuleFileUploadInput,
  ): Promise<UploadTicket> {
    return this.files.requestUpload(actor, parseId(id), body);
  }

  @Post('editor/modules/:id/files/:fileId/complete')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Confirmer un envoi : présence, taille, signature et empreinte vérifiées par le serveur',
  })
  @ApiOkResponse({ schema: openApiSchema(storedFileSchema) })
  confirm(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
  ): Promise<StoredFile> {
    return this.files.confirm(actor, parseId(id), parseId(fileId));
  }

  @Get('module-files/:fileId')
  @ApiOperation({
    summary: 'Contenu d’un fichier de module (redirection vers une URL signée courte)',
    description:
      'Accessible si une ressource de la version publiée le référence, ou aux personnes qui rédigent le module.',
  })
  @ApiFoundResponse({ description: 'Redirection vers le stockage (URL signée, quelques minutes).' })
  async download(
    @CurrentActor() actor: Actor,
    @Param('fileId') fileId: string,
    @Res() response: Response,
  ): Promise<void> {
    const url = await this.files.downloadUrl(actor, parseId(fileId));
    // URL signée : jamais en cache partagé, jamais transmise en Referer.
    response.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    response.redirect(302, url);
  }
}
