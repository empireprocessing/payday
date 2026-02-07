import { Injectable } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { DecryptedStorePSP } from '../psp/interfaces/psp.interface'
import { decryptPSPCredentials, encrypt, decrypt } from '../common/encryption'
import { PayDomainService } from '../pay-domain/pay-domain.service'
import { StorePlatform, PlatformConfig, validatePlatformConfig } from './interfaces/platform-config.interface'

@Injectable()
export class StoreService {
  constructor(
    private prisma: PrismaService,
    private payDomainService: PayDomainService,
  ) {}

  // Récupérer une boutique avec ses PSPs (avec déchiffrement)
  async getStoreWithPSPs(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: {
        payDomain: true,
        psps: {
          where: {
            psp: {
              isActive: true,
            },
          },
          include: {
            psp: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!store) return null

    // Déchiffrer les credentials des PSPs
    const decryptedPSPs: DecryptedStorePSP[] = store.psps.map(storePSP => {
      const decryptedCredentials = decryptPSPCredentials({
        publicKey: storePSP.psp.publicKey,
        secretKey: storePSP.psp.secretKey,
      })

      return {
        ...storePSP,
        psp: {
          ...storePSP.psp,
          publicKey: decryptedCredentials.publicKey,
          secretKey: decryptedCredentials.secretKey,
        }
      }
    })

    return {
      ...store,
      psps: decryptedPSPs,
    }
  }

  // Récupérer une boutique par son ID
  async getStoreById(storeId: string) {
    return await this.prisma.store.findUnique({
      where: { id: storeId },
      include: {
        payDomain: true,
        psps: {
          where: {
            psp: {
              isActive: true,
            },
          },
          include: {
            psp: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
  }

  // Récupérer une boutique par son domaine
  async getStoreByDomain(domain: string) {
    const store = await this.prisma.store.findUnique({
      where: { domain },
      include: {
        payDomain: true,
        psps: {
          where: {
            psp: {
              isActive: true,
            },
          },
          include: {
            psp: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!store) return null

    return store
  }

  // Récupérer une boutique par son payDomain
  async getStoreByPayDomain(payDomain: string) {
    const store = await this.prisma.store.findFirst({
      where: {
        payDomain: {
          hostname: payDomain,
        },
      },
      include: {
        payDomain: true,
        psps: {
          where: {
            psp: {
              isActive: true,
            },
          },
          include: {
            psp: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    return store
  }

  // Récupérer toutes les boutiques
  async getAllStores() {
    const stores = await this.prisma.store.findMany({
      include: {
        payDomain: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return stores
  }

  // Créer une nouvelle boutique
  async createStore(storeData: {
    name: string;
    domain: string;
    platform: StorePlatform;
    platformConfig?: PlatformConfig;
    logoUrl?: string;
    payDomain?: string; // hostname du payDomain
    runner?: string | null; // Nom de la personne responsable de la boutique
    requiresShipping?: boolean;
    addressSectionTitle?: string;
    shippingMethodTitle?: string;
    shippingMethodSubtitle?: string;
    shippingMinDays?: number;
    shippingMaxDays?: number;
    trustBadges?: Array<{ icon: string; title: string; subtitle: string }>;
    checkoutConfig?: any;
  }) {
    // Valider la configuration de plateforme
    const validation = validatePlatformConfig(storeData.platform, storeData.platformConfig);
    if (!validation.valid) {
      throw new Error(`Invalid platform configuration: ${validation.error}`);
    }

    // Séparer payDomain des autres données
    // NOTE: payDomain n'est PAS créé ici car il doit être créé via PayDomainService
    // pour déclencher l'ajout automatique à Vercel/Cloudflare
    const { payDomain, ...data } = storeData;

    // Préparer les données de création
    const createData: any = {
      name: data.name,
      domain: data.domain,
      platform: data.platform,
      platformConfig: data.platformConfig as any,
      logoUrl: data.logoUrl,
      runner: data.runner || null,
      requiresShipping: data.requiresShipping !== undefined ? data.requiresShipping : true,
      addressSectionTitle: data.addressSectionTitle,
      shippingMethodTitle: data.shippingMethodTitle,
      shippingMethodSubtitle: data.shippingMethodSubtitle,
      shippingMinDays: data.shippingMinDays,
      shippingMaxDays: data.shippingMaxDays,
      trustBadges: data.trustBadges as any,
      checkoutConfig: data.checkoutConfig as any,
    };

    // Ne pas créer payDomain ici - il sera créé via PayDomainService.createPayDomain()
    // dans le controller pour déclencher l'ajout à Vercel/Cloudflare

    return await this.prisma.store.create({
      data: createData,
      include: {
        payDomain: true,
      },
    });
  }

  // Mettre à jour une boutique
  async updateStore(storeId: string, updateData: {
    name?: string;
    domain?: string;
    platform?: StorePlatform;
    platformConfig?: PlatformConfig;
    logoUrl?: string;
    payDomain?: string; // hostname du payDomain
    supportEmail?: string | null;
    runner?: string | null; // Nom de la personne responsable de la boutique
    requiresShipping?: boolean;
    addressSectionTitle?: string | null;
    shippingMethodTitle?: string | null;
    shippingMethodSubtitle?: string | null;
    shippingMinDays?: number;
    shippingMaxDays?: number;
    trustBadges?: Array<{ icon: string; title: string; subtitle: string }> | null;
    checkoutConfig?: any;
  }) {
    console.log('🔍 updateStore called with:', { storeId, updateData });
    
    // Séparer les données du store et du payDomain
    const { payDomain, platform, platformConfig, ...storeData } = updateData;

    // Préparer les données de mise à jour
    const updatePayload: any = { ...storeData };

    // Valider que le nom n'est pas vide si fourni
    if (updatePayload.name !== undefined) {
      if (!updatePayload.name || updatePayload.name.trim() === '') {
        throw new Error('Le nom de la boutique ne peut pas être vide');
      }
      updatePayload.name = updatePayload.name.trim();
    }

    // Valider que le domaine n'est pas vide si fourni et vérifier l'unicité
    if (updatePayload.domain !== undefined) {
      if (!updatePayload.domain || updatePayload.domain.trim() === '') {
        throw new Error('Le domaine ne peut pas être vide');
      }
      updatePayload.domain = updatePayload.domain.trim();
      
      // Vérifier si le domaine est déjà utilisé par un autre store
      const existingStore = await this.prisma.store.findUnique({
        where: { domain: updatePayload.domain }
      });
      
      if (existingStore && existingStore.id !== storeId) {
        throw new Error(`Le domaine ${updatePayload.domain} est déjà utilisé par une autre boutique`);
      }
    }

    // Convertir les strings vides en null pour les champs optionnels
    if (updatePayload.logoUrl === '') {
      updatePayload.logoUrl = null;
    }
    if (updatePayload.supportEmail === '') {
      updatePayload.supportEmail = null;
    }
    if (updatePayload.runner === '') {
      updatePayload.runner = null;
    }

    // Si platform ou platformConfig sont fournis, valider
    // On ne valide que si on modifie effectivement la plateforme ou sa configuration
    if (platform !== undefined || platformConfig !== undefined) {
      const currentStore = await this.prisma.store.findUnique({
        where: { id: storeId },
        select: { platform: true, platformConfig: true }
      });

      if (!currentStore) {
        throw new Error(`Store with id ${storeId} not found`);
      }

      // Si on modifie la plateforme, utiliser la nouvelle plateforme et valider
      if (platform !== undefined) {
        const finalPlatform = platform;
        const finalConfig = platformConfig !== undefined ? platformConfig : currentStore.platformConfig;
        
        const validation = validatePlatformConfig(finalPlatform, finalConfig);
        if (!validation.valid) {
          throw new Error(`Invalid platform configuration: ${validation.error}`);
        }
        
        updatePayload.platform = platform;
      }

      // Si on modifie seulement la config (sans changer la plateforme), valider avec la plateforme actuelle
      if (platformConfig !== undefined && platform === undefined) {
        const finalPlatform = currentStore.platform as StorePlatform;
        const finalConfig = platformConfig;
        
        const validation = validatePlatformConfig(finalPlatform, finalConfig);
        if (!validation.valid) {
          throw new Error(`Invalid platform configuration: ${validation.error}`);
        }
        
        updatePayload.platformConfig = platformConfig as any;
      } else if (platformConfig !== undefined) {
        // Si on modifie les deux, la validation a déjà été faite ci-dessus
        updatePayload.platformConfig = platformConfig as any;
      }
    }

    // Gérer le payDomain séparément via PayDomainService (Vercel + Cloudflare)
    let shouldCreatePayDomain = false;
    let newPayDomainHostname: string | undefined;

    if (payDomain !== undefined && payDomain !== '') {
      // Vérifier si ce hostname est déjà utilisé par un autre store
      const existingHostname = await this.prisma.payDomain.findUnique({
        where: { hostname: payDomain }
      });

      if (existingHostname && existingHostname.storeId !== storeId) {
        throw new Error(`Le domaine ${payDomain} est déjà utilisé par une autre boutique`);
      }

      // Vérifier si un PayDomain existe déjà pour ce store
      const existingPayDomain = await this.prisma.payDomain.findUnique({
        where: { storeId }
      });

      if (existingPayDomain) {
        const hostnameChanged = existingPayDomain.hostname !== payDomain;
        if (hostnameChanged) {
          // Supprimer l'ancien domaine de Vercel/Cloudflare puis de la DB
          console.log(`🔄 PayDomain hostname changed: ${existingPayDomain.hostname} → ${payDomain}`);
          await this.payDomainService.deleteDomain(existingPayDomain.id);
          shouldCreatePayDomain = true;
          newPayDomainHostname = payDomain;
        }
        // Si le hostname n'a pas changé, ne rien faire
      } else {
        // Pas de PayDomain existant, en créer un nouveau
        shouldCreatePayDomain = true;
        newPayDomainHostname = payDomain;
      }
    }

    console.log('🔄 Updating store with payload:', updatePayload);

    try {
      // Vérifier d'abord que le store existe
      const storeExists = await this.prisma.store.findUnique({
        where: { id: storeId }
      });

      if (!storeExists) {
        console.error(`❌ Store not found with id: ${storeId}`);
        throw new Error(`Store with id ${storeId} not found`);
      }

      const updatedStore = await this.prisma.store.update({
        where: { id: storeId },
        data: updatePayload,
        include: {
          payDomain: true
        }
      });

      // Créer le nouveau PayDomain via PayDomainService (gère Vercel + Cloudflare)
      if (shouldCreatePayDomain && newPayDomainHostname) {
        console.log(`🌐 Creating PayDomain ${newPayDomainHostname} via PayDomainService (Vercel + Cloudflare)...`);
        await this.payDomainService.createPayDomain(storeId, { hostname: newPayDomainHostname });
        // Recharger le store avec le PayDomain fraîchement créé
        return await this.prisma.store.findUnique({
          where: { id: storeId },
          include: { payDomain: true }
        });
      }

      return updatedStore;
    } catch (error) {
      console.error('❌ Error updating store:', error);
      throw error;
    }
  }

  // Supprimer une boutique
  async deleteStore(storeId: string) {
    return await this.prisma.store.delete({
      where: { id: storeId },
    })
  }

  // Mettre à jour les paramètres Meta Conversion API
  async updateMetaSettings(storeId: string, metaSettings: {
    metaPixelId?: string;
    metaAccessToken?: string;
    metaNewCustomersOnly?: boolean;
  }) {
    const updateData: any = {};

    // Chiffrer l'access token si fourni
    if (metaSettings.metaAccessToken !== undefined) {
      updateData.metaAccessToken = metaSettings.metaAccessToken ? encrypt(metaSettings.metaAccessToken) : null;
    }

    // Pixel ID et newCustomersOnly ne nécessitent pas de chiffrement
    if (metaSettings.metaPixelId !== undefined) {
      updateData.metaPixelId = metaSettings.metaPixelId || null;
    }

    if (metaSettings.metaNewCustomersOnly !== undefined) {
      updateData.metaNewCustomersOnly = metaSettings.metaNewCustomersOnly;
    }

    return await this.prisma.store.update({
      where: { id: storeId },
      data: updateData,
      select: {
        id: true,
        metaPixelId: true,
        metaNewCustomersOnly: true,
        // Ne pas retourner le token chiffré
      }
    });
  }

  // Récupérer les paramètres Meta (avec déchiffrement)
  async getMetaSettings(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true,
        metaPixelId: true,
        metaAccessToken: true,
        metaNewCustomersOnly: true,
      }
    });

    if (!store) {
      throw new Error('Store not found');
    }

    // Déchiffrer l'access token si présent
    const decryptedToken = store.metaAccessToken ? decrypt(store.metaAccessToken) : null;

    return {
      id: store.id,
      metaPixelId: store.metaPixelId,
      metaAccessToken: decryptedToken,
      metaNewCustomersOnly: store.metaNewCustomersOnly,
    };
  }

  // Récupérer les credentials Meta déchiffrés pour usage interne
  async getMetaCredentials(storeId: string): Promise<{
    pixelId: string;
    accessToken: string;
    newCustomersOnly: boolean;
  } | null> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        metaPixelId: true,
        metaAccessToken: true,
        metaNewCustomersOnly: true,
      }
    });

    if (!store || !store.metaPixelId || !store.metaAccessToken) {
      return null;
    }

    return {
      pixelId: store.metaPixelId,
      accessToken: decrypt(store.metaAccessToken),
      newCustomersOnly: store.metaNewCustomersOnly,
    };
  }

  // Mettre à jour les paramètres TikTok Pixel
  async updateTiktokSettings(storeId: string, tiktokSettings: {
    tiktokPixelId?: string | null;
  }) {
    const updateData: any = {};

    if (tiktokSettings.tiktokPixelId !== undefined) {
      updateData.tiktokPixelId = tiktokSettings.tiktokPixelId || null;
    }

    return await this.prisma.store.update({
      where: { id: storeId },
      data: updateData,
      select: {
        id: true,
        tiktokPixelId: true,
      }
    });
  }

  // Récupérer les paramètres TikTok Pixel
  async getTiktokSettings(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true,
        tiktokPixelId: true,
      }
    });

    if (!store) {
      throw new Error('Store not found');
    }

    return {
      id: store.id,
      tiktokPixelId: store.tiktokPixelId,
    };
  }
}
