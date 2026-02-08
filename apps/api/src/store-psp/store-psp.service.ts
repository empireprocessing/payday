import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class StorePspService {
  constructor(private prisma: PrismaService) {}

  /**
   * Lier un PSP à une boutique
   */
  async linkPspToStore(storeId: string, pspId: string) {
    // Vérifier que la liaison n'existe pas déjà
    const existing = await this.prisma.storePSP.findUnique({
      where: {
        storeId_pspId: { storeId, pspId }
      }
    });

    if (existing) {
      throw new Error('Ce PSP est déjà lié à cette boutique');
    }

    return await this.prisma.storePSP.create({
      data: {
        storeId,
        pspId,
      },
      include: {
        psp: true,
        store: true,
      }
    });
  }

  /**
   * Délier un PSP d'une boutique
   */
  async unlinkPspFromStore(storeId: string, pspId: string) {
    return await this.prisma.storePSP.delete({
      where: {
        storeId_pspId: { storeId, pspId }
      }
    });
  }

  /**
   * Récupérer les PSP d'une boutique avec leurs infos complètes
   */
  async getPspsByStore(storeId: string) {
    return await this.prisma.storePSP.findMany({
      where: { storeId },
      include: {
        psp: true,
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  /**
   * Récupérer toutes les liaisons
   */
  async getAllLinks() {
    return await this.prisma.storePSP.findMany({
      include: {
        psp: true,
        store: true,
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Lier tous les PSP d'une liste à une boutique
   */
  async linkListToStore(storeId: string, listId: string) {
    // Vérifier que la liste existe
    const list = await this.prisma.pspList.findUnique({
      where: { id: listId },
      include: {
        items: {
          include: {
            psp: true,
          },
        },
      },
    });

    if (!list) {
      throw new NotFoundException(`Liste de PSP avec l'ID ${listId} non trouvée`);
    }

    // Vérifier que la boutique existe
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      throw new NotFoundException(`Boutique avec l'ID ${storeId} non trouvée`);
    }

    // Récupérer les PSP actifs de la liste
    const activePsps = list.items
      .filter(item => item.psp.isActive && !item.psp.deletedAt)
      .map(item => item.psp);

    // Enregistrer la liste utilisée dans la boutique
    await this.prisma.store.update({
      where: { id: storeId },
      data: { pspListId: listId },
    });

    // Récupérer les PSP actuellement liés à la boutique
    const currentStorePsps = await this.prisma.storePSP.findMany({
      where: { storeId },
      select: { pspId: true },
    });
    const currentPspIds = currentStorePsps.map(sp => sp.pspId);

    // PSP à ajouter (dans la liste mais pas encore liés)
    const pspIdsToAdd = activePsps
      .map(psp => psp.id)
      .filter(pspId => !currentPspIds.includes(pspId));

    // PSP à supprimer (liés mais plus dans la liste)
    const activePspIds = activePsps.map(psp => psp.id);
    const pspIdsToRemove = currentPspIds.filter(pspId => !activePspIds.includes(pspId));

    // Supprimer les PSP qui ne sont plus dans la liste
    if (pspIdsToRemove.length > 0) {
      await this.prisma.storePSP.deleteMany({
        where: {
          storeId,
          pspId: { in: pspIdsToRemove },
        },
      });
    }

    // Lier tous les PSP de la liste au store (en ignorant ceux déjà liés)
    const results = [];
    for (const psp of activePsps) {
      if (pspIdsToAdd.includes(psp.id)) {
        try {
          const link = await this.prisma.storePSP.create({
            data: {
              storeId,
              pspId: psp.id,
            },
            include: {
              psp: true,
              store: true,
            }
          });
          results.push(link);
        } catch (error) {
          // Ignorer les erreurs de duplication
          console.warn(`PSP ${psp.id} déjà lié au store ${storeId}`);
        }
      }
    }

    return {
      listId,
      listName: list.name,
      linkedCount: results.length,
      totalPsps: activePsps.length,
      links: results,
    };
  }
}
