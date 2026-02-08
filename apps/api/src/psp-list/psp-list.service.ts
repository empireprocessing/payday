import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class PspListService {
  constructor(private prisma: PrismaService) {}

  /**
   * Récupérer toutes les listes de PSP avec leurs PSP et les boutiques qui les utilisent
   */
  async getAllLists() {
    const lists = await this.prisma.pspList.findMany({
      include: {
        items: {
          include: {
            psp: {
              select: {
                id: true,
                name: true,
                pspType: true,
                isActive: true,
                deletedAt: true,
              },
            },
          },
          orderBy: {
            order: 'asc',
          },
        },
        stores: {
          select: {
            id: true,
            name: true,
            domain: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    return lists;
  }

  /**
   * Récupérer une liste par ID
   */
  async getListById(id: string) {
    const list = await this.prisma.pspList.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            psp: {
              select: {
                id: true,
                name: true,
                pspType: true,
                isActive: true,
                deletedAt: true,
              },
            },
          },
          orderBy: {
            order: 'asc',
          },
        },
        stores: {
          select: {
            id: true,
            name: true,
            domain: true,
          },
        },
      },
    });

    if (!list) {
      throw new NotFoundException(`Liste de PSP avec l'ID ${id} non trouvée`);
    }

    return list;
  }

  /**
   * Créer une nouvelle liste de PSP
   */
  async createList(data: {
    name: string;
    pspIds?: string[];
  }) {
    if (!data.name || data.name.trim().length === 0) {
      throw new BadRequestException('Le nom de la liste est requis');
    }

    // Vérifier que les PSP existent et sont actifs
    if (data.pspIds && data.pspIds.length > 0) {
      const psps = await this.prisma.psp.findMany({
        where: {
          id: { in: data.pspIds },
          isActive: true,
          deletedAt: null,
        },
      });

      if (psps.length !== data.pspIds.length) {
        throw new BadRequestException('Un ou plusieurs PSP sont invalides ou inactifs');
      }
    }

    // Créer la liste avec ses items
    return await this.prisma.pspList.create({
      data: {
        name: data.name,
        items: {
          create: data.pspIds?.map((pspId, index) => ({
            pspId,
            order: index,
          })) || [],
        },
      },
      include: {
        items: {
          include: {
            psp: {
              select: {
                id: true,
                name: true,
                pspType: true,
                isActive: true,
                deletedAt: true,
              },
            },
          },
          orderBy: {
            order: 'asc',
          },
        },
        stores: {
          select: {
            id: true,
            name: true,
            domain: true,
          },
        },
      },
    });
  }

  /**
   * Mettre à jour une liste de PSP
   */
  async updateList(id: string, data: {
    name?: string;
    pspIds?: string[];
  }) {
    const list = await this.prisma.pspList.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!list) {
      throw new NotFoundException(`Liste de PSP avec l'ID ${id} non trouvée`);
    }

    // Si pspIds est fourni, mettre à jour les items de la liste
    if (data.pspIds !== undefined) {
      if (data.pspIds.length === 0) {
        // Liste vide : supprimer tous les items
        await this.prisma.pspListItem.deleteMany({
          where: { pspListId: id },
        });
      } else {
        // Vérifier que les PSP existent et sont actifs
        const psps = await this.prisma.psp.findMany({
          where: {
            id: { in: data.pspIds },
            isActive: true,
            deletedAt: null,
          },
        });

        if (psps.length !== data.pspIds.length) {
          throw new BadRequestException('Un ou plusieurs PSP sont invalides ou inactifs');
        }

        // Supprimer les items qui ne sont plus dans la liste
        const currentPspIds = list.items.map(item => item.pspId);
        const pspIdsToRemove = currentPspIds.filter(pspId => !data.pspIds!.includes(pspId));

        if (pspIdsToRemove.length > 0) {
          await this.prisma.pspListItem.deleteMany({
            where: {
              pspListId: id,
              pspId: { in: pspIdsToRemove },
            },
          });
        }

        // Ajouter les nouveaux PSP
        const pspIdsToAdd = data.pspIds!.filter(pspId => !currentPspIds.includes(pspId));

        if (pspIdsToAdd.length > 0) {
          const maxOrder = list.items.length > 0
            ? Math.max(...list.items.map(item => item.order))
            : -1;

          await this.prisma.pspListItem.createMany({
            data: pspIdsToAdd.map((pspId, index) => ({
              pspListId: id,
              pspId,
              order: maxOrder + 1 + index,
            })),
          });
        }

        // Réorganiser l'ordre des PSP restants selon l'ordre dans pspIds
        const remainingItems = await this.prisma.pspListItem.findMany({
          where: {
            pspListId: id,
            pspId: { in: data.pspIds },
          },
        });

        for (let i = 0; i < data.pspIds.length; i++) {
          const pspId = data.pspIds[i];
          const item = remainingItems.find(item => item.pspId === pspId);
          if (item && item.order !== i) {
            await this.prisma.pspListItem.update({
              where: { id: item.id },
              data: { order: i },
            });
          }
        }
      }
    }

    // Mettre à jour le nom
    const updatedList = await this.prisma.pspList.update({
      where: { id },
      data: {
        name: data.name,
      },
      include: {
        items: {
          include: {
            psp: {
              select: {
                id: true,
                name: true,
                pspType: true,
                isActive: true,
                deletedAt: true,
              },
            },
          },
          orderBy: {
            order: 'asc',
          },
        },
        stores: {
          select: {
            id: true,
            name: true,
            domain: true,
          },
        },
      },
    });

    // Synchroniser les boutiques qui utilisent cette liste
    await this.syncStoresUsingList(id);

    return updatedList;
  }

  /**
   * Synchroniser les boutiques qui utilisent une liste de PSP
   * Cette fonction met à jour les PSP liés aux boutiques quand la liste change
   */
  private async syncStoresUsingList(listId: string) {
    // Trouver toutes les boutiques qui utilisent cette liste
    const stores = await this.prisma.store.findMany({
      where: {
        pspListId: listId,
      },
      select: {
        id: true,
        name: true,
        pspListId: true,
      },
    });

    if (stores.length === 0) {
      console.log(`[PspListService] ⚠️ Aucune boutique n'utilise la liste ${listId}`);
      return; // Aucune boutique n'utilise cette liste
    }

    console.log(`[PspListService] 🔄 Synchronisation de ${stores.length} boutique(s) utilisant la liste ${listId}:`, stores.map(s => s.name).join(', '));

    // Récupérer la liste mise à jour avec ses PSP actifs
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
      return;
    }

    const activePspIds = list.items
      .filter(item => item.psp.isActive && !item.psp.deletedAt)
      .map(item => item.psp.id);

    console.log(`[PspListService] 📋 Liste "${list.name}" contient ${activePspIds.length} PSP actif(s):`, activePspIds);

    // Pour chaque boutique, synchroniser les PSP
    for (const store of stores) {
      console.log(`[PspListService] 🔍 Synchronisation de la boutique "${store.name}" (${store.id})`);
      
      // Récupérer les PSP actuellement liés à la boutique
      const currentStorePsps = await this.prisma.storePSP.findMany({
        where: { storeId: store.id },
        select: { pspId: true },
      });
      const currentPspIds = currentStorePsps.map(sp => sp.pspId);
      
      console.log(`[PspListService] 📊 Boutique "${store.name}" a actuellement ${currentPspIds.length} PSP lié(s):`, currentPspIds);

      // PSP à ajouter (dans la liste mais pas encore liés)
      const pspIdsToAdd = activePspIds.filter(pspId => !currentPspIds.includes(pspId));

      // PSP à supprimer (liés mais plus dans la liste)
      const pspIdsToRemove = currentPspIds.filter(pspId => !activePspIds.includes(pspId));
      
      console.log(`[PspListService] ➕ ${pspIdsToAdd.length} PSP à ajouter à "${store.name}":`, pspIdsToAdd);
      console.log(`[PspListService] ➖ ${pspIdsToRemove.length} PSP à supprimer de "${store.name}":`, pspIdsToRemove);

      // Ajouter les nouveaux PSP
      for (const pspId of pspIdsToAdd) {
        try {
          await this.prisma.storePSP.create({
            data: {
              storeId: store.id,
              pspId,
            },
          });
        } catch (error) {
          // Ignorer les erreurs de duplication
          console.warn(`PSP ${pspId} déjà lié au store ${store.id}`);
        }
      }

      // Supprimer les PSP qui ne sont plus dans la liste
      // La boutique utilise cette liste (pspListId === listId), donc on synchronise complètement
      if (pspIdsToRemove.length > 0) {
        await this.prisma.storePSP.deleteMany({
          where: {
            storeId: store.id,
            pspId: { in: pspIdsToRemove },
          },
        });
        console.log(`[PspListService] ✅ ${pspIdsToRemove.length} PSP supprimé(s) de la boutique "${store.name}" (${store.id}):`, pspIdsToRemove);
      }

      if (pspIdsToAdd.length > 0) {
        console.log(`[PspListService] ✅ ${pspIdsToAdd.length} PSP ajouté(s) à la boutique "${store.name}" (${store.id}):`, pspIdsToAdd);
      }
      
      if (pspIdsToAdd.length === 0 && pspIdsToRemove.length === 0) {
        console.log(`[PspListService] ✓ Boutique "${store.name}" déjà synchronisée`);
      }
    }
    console.log(`[PspListService] Synchronisation terminée pour la liste ${listId}`);
  }

  /**
   * Supprimer une liste de PSP
   */
  async deleteList(id: string) {
    const list = await this.prisma.pspList.findUnique({
      where: { id },
    });

    if (!list) {
      throw new NotFoundException(`Liste de PSP avec l'ID ${id} non trouvée`);
    }

    // Les items seront supprimés automatiquement grâce à onDelete: Cascade
    return await this.prisma.pspList.delete({
      where: { id },
    });
  }

  /**
   * Ajouter des PSP à une liste
   */
  async addPspsToList(listId: string, pspIds: string[]) {
    const list = await this.prisma.pspList.findUnique({
      where: { id: listId },
      include: {
        items: true,
      },
    });

    if (!list) {
      throw new NotFoundException(`Liste de PSP avec l'ID ${listId} non trouvée`);
    }

    // Vérifier que les PSP existent et sont actifs
    const psps = await this.prisma.psp.findMany({
      where: {
        id: { in: pspIds },
        isActive: true,
        deletedAt: null,
      },
    });

    if (psps.length !== pspIds.length) {
      throw new BadRequestException('Un ou plusieurs PSP sont invalides ou inactifs');
    }

    // Filtrer les PSP qui ne sont pas déjà dans la liste
    const existingPspIds = list.items.map(item => item.pspId);
    const newPspIds = pspIds.filter(pspId => !existingPspIds.includes(pspId));

    if (newPspIds.length === 0) {
      return this.getListById(listId);
    }

    // Obtenir l'ordre maximum actuel
    const maxOrder = list.items.length > 0
      ? Math.max(...list.items.map(item => item.order))
      : -1;

    // Ajouter les nouveaux PSP
    await this.prisma.pspListItem.createMany({
      data: newPspIds.map((pspId, index) => ({
        pspListId: listId,
        pspId,
        order: maxOrder + 1 + index,
      })),
    });

    const updatedList = await this.getListById(listId);

    // Synchroniser les boutiques qui utilisent cette liste
    await this.syncStoresUsingList(listId);

    return updatedList;
  }

  /**
   * Retirer un PSP d'une liste
   */
  async removePspFromList(listId: string, pspId: string) {
    const list = await this.prisma.pspList.findUnique({
      where: { id: listId },
    });

    if (!list) {
      throw new NotFoundException(`Liste de PSP avec l'ID ${listId} non trouvée`);
    }

    const item = await this.prisma.pspListItem.findUnique({
      where: {
        pspListId_pspId: {
          pspListId: listId,
          pspId,
        },
      },
    });

    if (!item) {
      throw new NotFoundException('PSP non trouvé dans cette liste');
    }

    await this.prisma.pspListItem.delete({
      where: {
        pspListId_pspId: {
          pspListId: listId,
          pspId,
        },
      },
    });

    const updatedList = await this.getListById(listId);

    // Synchroniser les boutiques qui utilisent cette liste
    await this.syncStoresUsingList(listId);

    return updatedList;
  }
}
