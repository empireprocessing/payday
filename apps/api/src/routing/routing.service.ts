import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class RoutingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Récupérer la configuration de routing d'une boutique
   */
  async getRoutingConfig(storeId: string) {
    return await this.prisma.routingConfig.findUnique({
      where: { storeId },
      include: {
        pspWeights: {
          include: { psp: true }
        },
        fallbackSequence: {
          include: { psp: true },
          orderBy: { order: 'asc' }
        }
      }
    });
  }

  /**
   * Créer ou mettre à jour la configuration de routing
   */
  async updateRoutingConfig(storeId: string, configData: {
    mode: 'AUTOMATIC' | 'MANUAL';
    fallbackEnabled: boolean;
    maxRetries: number;
    weights?: Array<{ pspId: string; weight: number }>;
    fallbackSequence?: Array<{ pspId: string; order: number }>;
  }) {
    // Créer ou mettre à jour la config principale
    const routingConfig = await this.prisma.routingConfig.upsert({
      where: { storeId },
      update: {
        mode: configData.mode,
        fallbackEnabled: configData.fallbackEnabled,
        maxRetries: configData.maxRetries,
      },
      create: {
        storeId,
        mode: configData.mode,
        fallbackEnabled: configData.fallbackEnabled,
        maxRetries: configData.maxRetries,
      }
    });

    // Mettre à jour les poids si fournis
    if (configData.weights) {
      await this.updatePspWeights(storeId, configData.weights);
    }

    // Mettre à jour la séquence de fallback si fournie
    if (configData.fallbackSequence) {
      await this.updateFallbackSequence(storeId, configData.fallbackSequence);
    }

    return this.getRoutingConfig(storeId);
  }

  /**
   * Mettre à jour les poids PSP
   */
  async updatePspWeights(storeId: string, weights: Array<{ pspId: string; weight: number }>) {
    const routingConfig = await this.prisma.routingConfig.findUnique({
      where: { storeId }
    });

    if (!routingConfig) {
      throw new Error('Configuration de routing non trouvée');
    }

    // Supprimer les anciens poids
    await this.prisma.pSPWeight.deleteMany({
      where: { routingConfigId: routingConfig.id }
    });

    // Créer les nouveaux poids
    if (weights.length > 0) {
      const weightData = weights.map(weight => ({
        routingConfigId: routingConfig.id,
        pspId: weight.pspId,
        weight: weight.weight
      }));

      await this.prisma.pSPWeight.createMany({
        data: weightData
      });
    }

    return weights;
  }

  /**
   * Mettre à jour la séquence de fallback
   */
  async updateFallbackSequence(storeId: string, sequence: Array<{ pspId: string; order: number }>) {
    const routingConfig = await this.prisma.routingConfig.findUnique({
      where: { storeId }
    });

    if (!routingConfig) {
      throw new Error('Configuration de routing non trouvée');
    }

    // Supprimer l'ancienne séquence
    await this.prisma.fallbackSequence.deleteMany({
      where: { routingConfigId: routingConfig.id }
    });

    // Créer la nouvelle séquence
    if (sequence.length > 0) {
      const sequenceData = sequence.map(item => ({
        routingConfigId: routingConfig.id,
        pspId: item.pspId,
        order: item.order
      }));

      await this.prisma.fallbackSequence.createMany({
        data: sequenceData
      });
    }

    return sequence;
  }
}
