import { Module } from '@nestjs/common';
import { ModuleCatalogController } from './module-catalog.controller.js';
import { ModuleCatalogService } from './module-catalog.service.js';
import { ModuleEditorController } from './module-editor.controller.js';
import { ModuleDraftDeletionService } from './module-draft-deletion.service.js';
import { ModuleEditorService } from './module-editor.service.js';
import { ModuleFilesController } from './module-files.controller.js';
import { ModuleFilesService } from './module-files.service.js';
import { ModuleReviewController } from './module-review.controller.js';
import { ModuleReviewService } from './module-review.service.js';

/**
 * Modules pédagogiques : rédaction collaborative versionnée (chefs), workflow d'approbation
 * et de publication (responsable), bibliothèque des modules publiés (tous les utilisateurs),
 * fichiers joints conservés dans le stockage objet (D143).
 */
@Module({
  controllers: [
    ModuleCatalogController,
    ModuleEditorController,
    ModuleReviewController,
    ModuleFilesController,
  ],
  providers: [
    ModuleCatalogService,
    ModuleEditorService,
    ModuleDraftDeletionService,
    ModuleReviewService,
    ModuleFilesService,
  ],
})
export class PedagogyModule {}
