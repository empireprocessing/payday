import { Controller, Get, Param, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
  ) {}

  /**
   * Métriques globales du dashboard
   */
  @Get('overview')
  async getOverviewMetrics(
    @Query('period') period: 'day' | 'week' | 'month' = 'month',
    @Query('storeIds') storeIds?: string,
    @Query('days') days?: string
  ) {
    const storeIdsArray = storeIds ? storeIds.split(',').filter(id => id.trim()) : undefined;
    const daysNumber = days ? parseInt(days) : undefined;
    return this.analyticsService.getOverviewMetrics(period, storeIdsArray, daysNumber);
  }

  /**
   * Métriques par boutique
   */
  @Get('stores')
  async getStoreMetrics(
    @Query('period') period: 'day' | 'week' | 'month' = 'month',
    @Query('storeIds') storeIds?: string,
    @Query('days') days?: string
  ) {
    const storeIdsArray = storeIds ? storeIds.split(',').filter(id => id.trim()) : undefined;
    const daysNumber = days ? parseInt(days) : undefined;
    return this.analyticsService.getStoreMetrics(period, storeIdsArray, daysNumber);
  }

  /**
   * Métriques par PSP
   */
  @Get('psps')
  async getPspMetrics(
    @Query('period') period: 'day' | 'week' | 'month' = 'month',
    @Query('storeIds') storeIds?: string,
    @Query('days') days?: string
  ) {
    const storeIdsArray = storeIds ? storeIds.split(',').filter(id => id.trim()) : undefined;
    const daysNumber = days ? parseInt(days) : undefined;
    return this.analyticsService.getPspMetrics(period, storeIdsArray, daysNumber);
  }

  /**
   * Données de tendance pour les graphiques
   */
  @Get('trends')
  async getTrendData(
    @Query('period') period: 'day' | 'week' | 'month' = 'week',
    @Query('days') days: string = '7',
    @Query('storeIds') storeIds?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string
  ) {
    const storeIdsArray = storeIds ? storeIds.split(',').filter(id => id.trim()) : undefined;
    let from: Date | undefined;
    let to: Date | undefined;
    
    if (fromDate) {
      from = new Date(fromDate);
      if (isNaN(from.getTime())) {
        throw new Error(`Invalid fromDate: ${fromDate}`);
      }
    }
    
    if (toDate) {
      to = new Date(toDate);
      if (isNaN(to.getTime())) {
        throw new Error(`Invalid toDate: ${toDate}`);
      }
    }
    
    return this.analyticsService.getTrendData(period, parseInt(days), storeIdsArray, from, to);
  }

  /**
   * Comparaison des PSP
   */
  @Get('psp-comparison')
  async getPspComparison(
    @Query('storeIds') storeIds?: string
  ) {
    const storeIdsArray = storeIds ? storeIds.split(',').filter(id => id.trim()) : undefined;
    return this.analyticsService.getPspComparison(storeIdsArray);
  }

  /**
   * Analytics détaillées pour une boutique
   */
  @Get('stores/:storeId')
  async getStoreDetailedMetrics(
    @Param('storeId') storeId: string,
    @Query('period') period: 'day' | 'week' | 'month' = 'month'
  ) {
    return this.analyticsService.getStoreDetailedMetrics(storeId, period);
  }

  /**
   * Métriques temps réel (dernières 24h)
   */
  @Get('realtime')
  async getRealtimeMetrics() {
    return this.analyticsService.getOverviewMetrics('day');
  }

  /**
   * Funnel de conversion par boutique
   */
  @Get('stores/:storeId/funnel')
  async getStoreConversionFunnel(
    @Param('storeId') storeId: string,
    @Query('period') period: 'day' | 'week' | 'month' = 'month'
  ) {
    return this.analyticsService.getStoreConversionFunnel(storeId, period);
  }

  /**
   * Funnel de conversion global
   */
  @Get('funnel')
  async getGlobalConversionFunnel(
    @Query('period') period: 'day' | 'week' | 'month' = 'month'
  ) {
    return this.analyticsService.getGlobalConversionFunnel(period);
  }

  /**
   * Revenus quotidiens pour un store spécifique
   */
  @Get('stores/:storeId/daily-revenue')
  async getStoreDailyRevenue(
    @Param('storeId') storeId: string,
    @Query('days') days: string = '30'
  ) {
    return this.analyticsService.getStoreDailyRevenue(storeId, parseInt(days));
  }

  /**
   * Approval rate par PSP et global pour un store
   */
  @Get('stores/:storeId/approval-rate')
  async getStoreApprovalRate(
    @Param('storeId') storeId: string,
    @Query('period') period: 'day' | 'week' | 'month' = 'month'
  ) {
    return this.analyticsService.getStoreApprovalRate(storeId, period);
  }

  /**
   * Checkouts initiés quotidiens pour un store spécifique
   */
  @Get('stores/:storeId/daily-checkouts')
  async getStoreDailyCheckouts(
    @Param('storeId') storeId: string,
    @Query('days') days: string = '30'
  ) {
    return this.analyticsService.getStoreDailyCheckouts(storeId, parseInt(days));
  }

  /**
   * PSP avec usage 24h et capacité
   */
  @Get('psps-usage')
  async getPspsWithUsage(
    @Query('storeIds') storeIds?: string,
    @Query('period') period: 'day' | 'week' | 'month' = 'month',
    @Query('days') days?: string
  ) {
    const storeIdsArray = storeIds ? storeIds.split(',').filter(id => id.trim()) : undefined;
    const daysNumber = days ? parseInt(days) : undefined;
    return this.analyticsService.getPspsWithUsage(storeIdsArray, period, daysNumber);
  }

  /**
   * Taux d'approbation quotidiens (normaux et récurrents)
   */
  @Get('approval-rates')
  async getApprovalRates(
    @Query('storeIds') storeIds?: string,
    @Query('days') days?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string
  ) {
    const storeIdsArray = storeIds ? storeIds.split(',').filter(id => id.trim()) : undefined;
    const daysNumber = days ? parseInt(days) : undefined;
    let from: Date | undefined;
    let to: Date | undefined;
    
    if (fromDate) {
      from = new Date(fromDate);
      if (isNaN(from.getTime())) {
        throw new Error(`Invalid fromDate: ${fromDate}`);
      }
    }
    
    if (toDate) {
      to = new Date(toDate);
      if (isNaN(to.getTime())) {
        throw new Error(`Invalid toDate: ${toDate}`);
      }
    }
    
    return this.analyticsService.getApprovalRates(storeIdsArray, daysNumber, from, to);
  }

  /**
   * Détails complets d'un PSP avec métriques
   */
  @Get('psp/:id')
  async getPspDetails(@Param('id') id: string) {
    return this.analyticsService.getPspDetails(id);
  }

  /**
   * Données d'usage quotidien pour un PSP
   */
  @Get('psp/:id/usage-trend')
  async getPspUsageTrend(
    @Param('id') id: string,
    @Query('days') days?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string
  ) {
    const daysNumber = days ? parseInt(days) : undefined;
    let from: Date | undefined;
    let to: Date | undefined;

    if (fromDate) {
      from = new Date(fromDate);
      if (isNaN(from.getTime())) {
        throw new Error(`Invalid fromDate: ${fromDate}`);
      }
    }

    if (toDate) {
      to = new Date(toDate);
      if (isNaN(to.getTime())) {
        throw new Error(`Invalid toDate: ${toDate}`);
      }
    }

    return this.analyticsService.getPspUsageTrend(id, daysNumber, from, to);
  }

  /**
   * Fonds à venir pour un PSP (balance pending avec dates de disponibilité)
   */
  @Get('psp/:id/upcoming-funds')
  async getPspUpcomingFunds(@Param('id') id: string) {
    return this.analyticsService.getPspUpcomingFunds(id);
  }
}
