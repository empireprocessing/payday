import { Controller, Get, Put, Body, Param, ValidationPipe } from '@nestjs/common';
import { RoutingService } from './routing.service';

@Controller('routing')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  /**
   * Récupérer la configuration de routing d'une boutique
   */
  @Get('store/:storeId')
  async getRoutingConfig(@Param('storeId') storeId: string) {
    return this.routingService.getRoutingConfig(storeId);
  }

  /**
   * Créer ou mettre à jour la configuration de routing
   */
  @Put('store/:storeId')
  async updateRoutingConfig(
    @Param('storeId') storeId: string,
    @Body(ValidationPipe) configData: {
      mode: 'AUTOMATIC' | 'MANUAL';
      fallbackEnabled: boolean;
      maxRetries: number;
      weights?: Array<{ pspId: string; weight: number }>;
      fallbackSequence?: Array<{ pspId: string; order: number }>;
    }
  ) {
    return this.routingService.updateRoutingConfig(storeId, configData);
  }

  /**
   * Mettre à jour les poids PSP pour le routing manuel
   */
  @Put('store/:storeId/weights')
  async updatePspWeights(
    @Param('storeId') storeId: string,
    @Body(ValidationPipe) weights: Array<{ pspId: string; weight: number }>
  ) {
    return this.routingService.updatePspWeights(storeId, weights);
  }

  /**
   * Mettre à jour la séquence de fallback
   */
  @Put('store/:storeId/fallback')
  async updateFallbackSequence(
    @Param('storeId') storeId: string,
    @Body(ValidationPipe) sequence: Array<{ pspId: string; order: number }>
  ) {
    return this.routingService.updateFallbackSequence(storeId, sequence);
  }
}
