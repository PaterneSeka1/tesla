import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
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
  type AddReferenceEntryInput,
  addReferenceEntryInputSchema,
  type CreateReferenceCategoryInput,
  createReferenceCategoryInputSchema,
  type ManagedReference,
  managedReferenceSchema,
  type ReferenceCatalog,
  referenceCatalogSchema,
  type ReorderReferenceInput,
  reorderReferenceInputSchema,
  type UpdateReferenceCategoryInput,
  updateReferenceCategoryInputSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { openApiSchema } from '../../common/openapi.js';
import { parseId } from '../../common/validation.js';
import { CurrentActor } from '../auth/auth.decorators.js';
import { ReferenceService } from './reference.service.js';

/** Référentiel scout (D220) : rubriques et rangements de modules publiés. */
@ApiTags('Référentiel scout')
@ApiCookieAuth()
@Controller('reference')
export class ReferenceController {
  constructor(private readonly reference: ReferenceService) {}

  @Get()
  @ApiOperation({
    summary: 'Référentiel visible : rubriques non vides et ressources publiées',
    description: 'Avec `q`, seules les ressources dont le titre ou le texte correspond.',
  })
  @ApiQuery({ name: 'q', required: false })
  @ApiOkResponse({ schema: openApiSchema(referenceCatalogSchema) })
  catalog(@CurrentActor() actor: Actor, @Query('q') q?: string): Promise<ReferenceCatalog> {
    return this.reference.catalog(actor, q);
  }

  @Get('manage')
  @ApiOperation({ summary: 'Gestion : toutes les rubriques et l’état des rangements' })
  @ApiOkResponse({ schema: openApiSchema(managedReferenceSchema) })
  manage(@CurrentActor() actor: Actor): Promise<ManagedReference> {
    return this.reference.manage(actor);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Créer une rubrique (responsable plein en fonction)' })
  @ApiBody({ schema: openApiSchema(createReferenceCategoryInputSchema, 'input') })
  @ApiCreatedResponse({ description: 'Identifiant de la rubrique.' })
  createCategory(
    @CurrentActor() actor: Actor,
    @Body() body: CreateReferenceCategoryInput,
  ): Promise<{ id: string }> {
    return this.reference.createCategory(actor, body);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Modifier, retirer ou rétablir une rubrique' })
  @ApiBody({ schema: openApiSchema(updateReferenceCategoryInputSchema, 'input') })
  updateCategory(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: UpdateReferenceCategoryInput,
  ): Promise<{ id: string }> {
    return this.reference.updateCategory(actor, parseId(id), body);
  }

  @Post('categories/order')
  @HttpCode(200)
  @ApiOperation({ summary: 'Ordonner les rubriques' })
  @ApiBody({ schema: openApiSchema(reorderReferenceInputSchema, 'input') })
  reorderCategories(
    @CurrentActor() actor: Actor,
    @Body() body: ReorderReferenceInput,
  ): Promise<{ ok: true }> {
    return this.reference.reorderCategories(actor, body);
  }

  @Post('categories/:id/order')
  @HttpCode(200)
  @ApiOperation({ summary: 'Ordonner les ressources d’une rubrique' })
  @ApiBody({ schema: openApiSchema(reorderReferenceInputSchema, 'input') })
  reorderEntries(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: ReorderReferenceInput,
  ): Promise<{ ok: true }> {
    return this.reference.reorderEntries(actor, parseId(id), body);
  }

  @Post('entries')
  @ApiOperation({ summary: 'Ranger un module ou une de ses leçons dans une rubrique' })
  @ApiBody({ schema: openApiSchema(addReferenceEntryInputSchema, 'input') })
  @ApiCreatedResponse({ description: 'Identifiant du rangement.' })
  addEntry(
    @CurrentActor() actor: Actor,
    @Body() body: AddReferenceEntryInput,
  ): Promise<{ id: string }> {
    return this.reference.addEntry(actor, body);
  }

  @Delete('entries/:id')
  @ApiOperation({ summary: 'Retirer un rangement (le module reste intact)' })
  @ApiOkResponse({ description: 'Rangement retiré.' })
  removeEntry(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<{ ok: true }> {
    return this.reference.removeEntry(actor, parseId(id));
  }
}
