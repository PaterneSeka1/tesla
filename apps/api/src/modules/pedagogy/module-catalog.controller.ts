import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  offlineModulePackageSchema,
  type CatalogLesson,
  catalogLessonSchema,
  type CatalogModuleDetail,
  catalogModuleDetailSchema,
  type CatalogPage,
  catalogPageSchema,
  type CatalogQuery,
  type PrintableModule,
  printableModuleSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { openApiSchema } from '../../common/openapi.js';
import { parseId } from '../../common/validation.js';
import { CurrentActor } from '../auth/auth.decorators.js';
import { ModuleCatalogService } from './module-catalog.service.js';

@ApiTags('Bibliothèque')
@ApiCookieAuth()
@Controller('modules')
export class ModuleCatalogController {
  constructor(private readonly catalog: ModuleCatalogService) {}

  @Get()
  @ApiOperation({
    summary: 'Modules publiés (tout utilisateur connecté)',
    description: 'Consultation libre, sans condition d’étape. Aucun brouillon n’est renvoyé.',
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'stageId', required: false })
  @ApiQuery({ name: 'theme', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOkResponse({ schema: openApiSchema(catalogPageSchema) })
  list(@CurrentActor() actor: Actor, @Query() query: CatalogQuery): Promise<CatalogPage> {
    return this.catalog.list(actor, query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Module publié : objectifs, leçons, ressources' })
  @ApiOkResponse({ schema: openApiSchema(catalogModuleDetailSchema) })
  get(@CurrentActor() actor: Actor, @Param('slug') slug: string): Promise<CatalogModuleDetail> {
    return this.catalog.get(actor, slug);
  }

  @Get(':slug/offline-package')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Paquet publié complet et empreinte SHA-256 pour téléchargement explicite',
  })
  @ApiOkResponse({ schema: openApiSchema(offlineModulePackageSchema) })
  offlinePackage(@CurrentActor() actor: Actor, @Param('slug') slug: string) {
    return this.catalog.offlinePackage(actor, slug);
  }

  @Get(':slug/print')
  @ApiOperation({ summary: 'Contenu complet de la version publiée (impression A4)' })
  @ApiOkResponse({ schema: openApiSchema(printableModuleSchema) })
  print(@CurrentActor() actor: Actor, @Param('slug') slug: string): Promise<PrintableModule> {
    return this.catalog.printable(actor, slug);
  }

  @Get(':slug/lessons/:lessonId')
  @ApiOperation({ summary: 'Leçon d’un module publié, avec leçons précédente et suivante' })
  @ApiOkResponse({ schema: openApiSchema(catalogLessonSchema) })
  lesson(
    @CurrentActor() actor: Actor,
    @Param('slug') slug: string,
    @Param('lessonId') lessonId: string,
  ): Promise<CatalogLesson> {
    return this.catalog.lesson(actor, slug, parseId(lessonId));
  }
}
