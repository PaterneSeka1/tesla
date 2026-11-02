import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type RequestModuleFileUploadInput,
  requestModuleFileUploadInputSchema,
  type StoredFile as StoredFileDto,
  type StoredFileMimeType,
  type UploadTicket,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan, can } from '../../common/permissions.js';
import { parseInput } from '../../common/validation.js';
import { type StoredFile } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StoredFilesService } from '../../storage/stored-files.service.js';
import { resolveAccess } from './module-common.js';

/** Envois en attente simultanés par personne (protection contre le remplissage du stockage). */
const MAX_PENDING_UPLOADS = 20;

const fileNotFound = () =>
  new NotFoundException({ code: 'FILE_NOT_FOUND', message: 'Fichier introuvable.' });

/**
 * Fichiers joints aux modules (D143). Envoi : auteur, collaborateur ou responsable d'un module dont
 * une version est en brouillon. Lecture : toute personne connectée si une ressource de la version
 * **publiée** d'un module le référence ; sinon seulement les personnes qui rédigent ce module.
 * Un objet présent dans le stockage n'est donc jamais accessible du seul fait de son existence.
 */
@Injectable()
export class ModuleFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: StoredFilesService,
  ) {}

  async requestUpload(
    actor: Actor,
    moduleId: string,
    input: RequestModuleFileUploadInput,
  ): Promise<UploadTicket> {
    assertCan(actor, 'module.write');
    const data = parseInput(requestModuleFileUploadInputSchema, input);
    await resolveAccess(this.prisma, actor, moduleId);
    const draft = await this.prisma.moduleVersion.findFirst({
      where: { moduleId, status: 'BROUILLON' },
      select: { id: true },
    });
    if (!draft) {
      throw new ConflictException({
        code: 'VERSION_NOT_EDITABLE',
        message: 'Aucune version de ce module n’est en brouillon : ouvrez une nouvelle version.',
      });
    }
    const pending = await this.prisma.storedFile.count({
      where: {
        createdById: actor.userId,
        status: 'EN_ATTENTE',
        uploadExpiresAt: { gt: new Date() },
      },
    });
    if (pending >= MAX_PENDING_UPLOADS) {
      throw new HttpException(
        {
          code: 'TOO_MANY_PENDING_UPLOADS',
          message: 'Trop d’envois en cours. Réessayez dans quelques minutes.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return this.files.requestUpload({
      category: 'MODULE_RESOURCE',
      moduleId,
      createdById: actor.userId,
      fileName: data.fileName,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      sha256: data.sha256,
    });
  }

  /** Confirmation par la personne qui a demandé l'envoi (ou le responsable), après vérification réelle. */
  async confirm(actor: Actor, moduleId: string, fileId: string): Promise<StoredFileDto> {
    assertCan(actor, 'module.write');
    await resolveAccess(this.prisma, actor, moduleId);
    const file = await this.prisma.storedFile.findFirst({
      where: { id: fileId, moduleId, category: 'MODULE_RESOURCE' },
    });
    if (!file || (file.createdById !== actor.userId && !can(actor, 'module.writeAny'))) {
      throw fileNotFound();
    }
    return toStoredFile(await this.files.confirm(file));
  }

  /** URL signée courte du contenu, après contrôle d'accès (jamais d'URL publique). */
  async downloadUrl(actor: Actor, fileId: string): Promise<string> {
    assertCan(actor, 'module.read');
    const file = await this.prisma.storedFile.findFirst({
      where: { id: fileId, category: 'MODULE_RESOURCE', status: 'VALIDE' },
    });
    if (!file || !(await this.canRead(actor, file))) throw fileNotFound();
    return this.files.downloadUrl(file);
  }

  private async canRead(actor: Actor, file: StoredFile): Promise<boolean> {
    const references = await this.prisma.moduleResource.findMany({
      where: { fileId: file.id },
      select: {
        versionId: true,
        version: { select: { moduleId: true, module: { select: { publishedVersionId: true } } } },
      },
    });
    if (references.some((ref) => ref.version.module.publishedVersionId === ref.versionId))
      return true;
    if (!can(actor, 'module.write')) return false;
    // Rédaction : module propriétaire du fichier ou module qui le référence (versions de travail).
    const moduleIds = new Set([file.moduleId, ...references.map((ref) => ref.version.moduleId)]);
    for (const moduleId of moduleIds) {
      if (!moduleId) continue;
      try {
        await resolveAccess(this.prisma, actor, moduleId);
        return true;
      } catch (error) {
        // Module non accessible à cette personne (404) : essayer le suivant.
        if (!(error instanceof NotFoundException)) throw error;
      }
    }
    return false;
  }
}

function toStoredFile(file: StoredFile): StoredFileDto {
  return {
    id: file.id,
    status: file.status,
    originalName: file.originalName,
    mimeType: file.mimeType as StoredFileMimeType,
    sizeBytes: file.sizeBytes,
    createdAt: file.createdAt.toISOString(),
    validatedAt: file.validatedAt?.toISOString() ?? null,
  };
}
