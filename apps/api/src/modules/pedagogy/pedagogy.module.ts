import { Module } from '@nestjs/common';
import { ModuleCatalogController } from './module-catalog.controller.js';
import { ModuleCatalogService } from './module-catalog.service.js';
import { ModuleEditorController } from './module-editor.controller.js';
import { ModuleEditorService } from './module-editor.service.js';
import { ModuleReviewController } from './module-review.controller.js';
import { ModuleReviewService } from './module-review.service.js';

/**
 * Modules pédagogiques : rédaction collaborative versionnée (chefs), workflow d'approbation
 * et de publication (responsable), bibliothèque des modules publiés (tous les utilisateurs).
 */
@Module({
  controllers: [ModuleCatalogController, ModuleEditorController, ModuleReviewController],
  providers: [ModuleCatalogService, ModuleEditorService, ModuleReviewService],
})
export class PedagogyModule {}
