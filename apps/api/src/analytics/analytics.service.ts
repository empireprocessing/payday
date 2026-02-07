import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PaymentStatus } from '@prisma/client';
import { decryptPSPCredentials } from '../common/encryption';
import { getBusinessDayStartUTC } from '../common/business-day';

export interface OverviewMetrics {
  totalStores: number;
  totalPsps: number;
  totalOrders: number;
  totalPayments: number;
  successfulPayments: number;
  conversionRate: number;
  totalRevenue: number;
  growth: {
    stores: number;
    psps: number;
    payments: number;
    revenue: number;
  };
}

export interface StoreMetric {
  id: string;
  name: string;
  domain: string;
  platform: string;
  totalOrders: number;
  successfulOrders: number;
  totalRevenue: number;
  pspCount: number;
  conversionRate: number;
}

export interface PspMetric {
  id: string;
  pspType: string;
  name: string;
  storeName: string;
  storeId: string;
  totalPayments: number;
  successfulPayments: number;
  totalRevenue: number;
  conversionRate: number;
  isActive: boolean;
  avgProcessingTime?: number;
}

export interface TrendData {
  date: string;
  totalPayments: number;
  successfulPayments: number;
  totalAmount: number;
  successfulAmount: number;
  pspBreakdown: Record<string, {
    total: number;
    successful: number;
    amount: number;
  }>;
}

export interface PspComparison {
  pspType: string;
  name: string;
  totalConfigurations: number;
  activeConfigurations: number;
  totalPayments: number;
  successfulPayments: number;
  totalRevenue: number;
  conversionRate: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calcule les dates de début et de fin de manière cohérente
   */
  private calculateDateRange(days?: number, period?: 'day' | 'week' | 'month', fromDate?: Date, toDate?: Date): { startDate: Date; endDate: Date } {
    let startDate: Date;
    let endDate: Date = new Date();
    endDate.setHours(23, 59, 59, 999);

    if (fromDate && toDate) {
      // Période personnalisée : utiliser les dates exactes
      // Valider que les dates sont valides
      const from = new Date(fromDate);
      const to = new Date(toDate);
      
      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        throw new Error('Invalid date range provided');
      }
      
      startDate = from;
      startDate.setHours(0, 0, 0, 0);
      endDate = to;
      endDate.setHours(23, 59, 59, 999);
    } else if (days) {
      // Utiliser days si fourni
      // Calculer startDate en soustrayant 'days' jours pour obtenir les 'days' derniers jours
      // Par exemple, pour 7 jours : on soustrait 7 jours de la date de fin
      startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
      startDate.setHours(0, 0, 0, 0);
    } else if (period) {
      // Utiliser period si days n'est pas fourni
      startDate = this.getStartDate(period);
      startDate.setHours(0, 0, 0, 0);
    } else {
      // Par défaut : 30 jours
      startDate = new Date(endDate.getTime() - (30 * 24 * 60 * 60 * 1000));
      startDate.setHours(0, 0, 0, 0);
    }

    return { startDate, endDate };
  }

  /**
   * Métriques globales du dashboard
   */
  async getOverviewMetrics(period: 'day' | 'week' | 'month' = 'month', storeIds?: string[], days?: number): Promise<OverviewMetrics> {
    // Calculer les dates de début et de fin de la période de manière cohérente
    // Si days n'est pas fourni, calculer depuis period pour garantir la cohérence avec getTrendData
    // getTrendData utilise toujours days (valeur par défaut 7), donc on doit faire de même ici
    const effectiveDays = days !== undefined && days !== null 
      ? days 
      : (period === 'day' ? 1 : period === 'week' ? 7 : 30);
    const { startDate, endDate } = this.calculateDateRange(effectiveDays, undefined);
    
    const previousStartDate = days 
      ? new Date(startDate.getTime() - (days * 24 * 60 * 60 * 1000))
      : this.getPreviousPeriodStartDate(period);
    previousStartDate.setHours(0, 0, 0, 0);
    const previousEndDate = new Date(startDate);
    previousEndDate.setHours(23, 59, 59, 999);

    // Construire les filtres pour les stores
    const storeFilter = storeIds && storeIds.length > 0 ? { id: { in: storeIds } } : undefined;

    // Compter les stores
    const totalStores = await this.prisma.store.count(storeFilter ? { where: storeFilter } : undefined);

    // Compter les PSP actifs
    // Si des boutiques sont filtrées, compter uniquement les PSP utilisés par ces boutiques
    let totalPsps: number;
    if (storeIds && storeIds.length > 0) {
      // Récupérer les stores avec leurs listes de PSP et PSP directement liés
      const stores = await this.prisma.store.findMany({
        where: { id: { in: storeIds } },
        include: {
          pspList: {
            include: {
              items: {
                include: {
                  psp: true
                }
              }
            }
          },
          psps: {
            include: {
              psp: true
            }
          }
        }
      });

      // Collecter tous les PSP uniques utilisés par ces boutiques
      const uniquePspIds = new Set<string>();
      
      stores.forEach(store => {
        // Si le store utilise une liste de PSP
        if (store.pspList) {
          store.pspList.items
            .filter(item => item.psp.isActive && !item.psp.deletedAt)
            .forEach(item => uniquePspIds.add(item.psp.id));
        } else {
          // Sinon, utiliser les PSP directement liés
          store.psps
            .filter(sp => sp.psp.isActive && !sp.psp.deletedAt)
            .forEach(sp => uniquePspIds.add(sp.psp.id));
        }
      });

      // Compter uniquement les PSP actifs parmi ceux utilisés
      totalPsps = uniquePspIds.size;
    } else {
      // Pas de filtre de boutique : compter tous les PSP actifs
      totalPsps = await this.prisma.psp.count({ where: { isActive: true } });
    }

    // Construire les filtres pour les commandes et paiements avec date de fin explicite
    const orderFilter: any = {
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    };
    const paymentFilter: any = {
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    };
    const successfulPaymentFilter: any = {
      createdAt: {
        gte: startDate,
        lte: endDate
      },
      status: PaymentStatus.SUCCESS
    };
    if (storeFilter) {
      orderFilter.storeId = { in: storeIds };
      paymentFilter.storeId = { in: storeIds };
      successfulPaymentFilter.storeId = { in: storeIds };
    }

    // Compter les commandes et paiements sur la période actuelle
    const [orders, totalPayments, successfulPaymentsData] = await Promise.all([
      this.prisma.order.findMany({
        where: orderFilter,
        select: { id: true, totalAmount: true, paymentStatus: true }
      }),
      this.prisma.payment.count({
        where: paymentFilter
      }),
      this.prisma.payment.aggregate({
        where: successfulPaymentFilter,
        _count: true,
        _sum: { amount: true }
      })
    ]);

    // Construire les filtres pour la période précédente
    const previousOrderFilter: any = {
      createdAt: {
        gte: previousStartDate,
        lte: previousEndDate
      }
    };
    const previousSuccessfulPaymentFilter: any = {
      createdAt: {
        gte: previousStartDate,
        lte: previousEndDate
      },
      status: PaymentStatus.SUCCESS
    };
    if (storeFilter) {
      previousOrderFilter.storeId = { in: storeIds };
      previousSuccessfulPaymentFilter.storeId = { in: storeIds };
    }

    // Compter les commandes et paiements réussis sur la période précédente
    const [previousOrders, previousSuccessfulPaymentsData] = await Promise.all([
      this.prisma.order.findMany({
        where: previousOrderFilter,
        select: { id: true, totalAmount: true, paymentStatus: true }
      }),
      this.prisma.payment.aggregate({
        where: previousSuccessfulPaymentFilter,
        _count: true,
        _sum: { amount: true }
      })
    ]);

    // Compter les stores et PSP à la fin de la période précédente
    const previousStoreFilter = storeFilter ? { ...storeFilter, createdAt: { lt: startDate } } : { createdAt: { lt: startDate } };
    const previousStores = await this.prisma.store.count({
      where: previousStoreFilter
    });

    // Compter les PSP pour la période précédente (même logique que pour la période actuelle)
    let previousPsps: number;
    if (storeIds && storeIds.length > 0) {
      // Récupérer les stores avec leurs listes de PSP et PSP directement liés
      const previousStores = await this.prisma.store.findMany({
        where: { 
          id: { in: storeIds },
          createdAt: { lt: startDate }
        },
        include: {
          pspList: {
            include: {
              items: {
                include: {
                  psp: true
                }
              }
            }
          },
          psps: {
            include: {
              psp: true
            }
          }
        }
      });

      // Collecter tous les PSP uniques utilisés par ces boutiques dans la période précédente
      const previousUniquePspIds = new Set<string>();
      
      previousStores.forEach(store => {
        // Si le store utilise une liste de PSP
        if (store.pspList) {
          store.pspList.items
            .filter(item => item.psp.isActive && !item.psp.deletedAt)
            .forEach(item => previousUniquePspIds.add(item.psp.id));
        } else {
          // Sinon, utiliser les PSP directement liés
          store.psps
            .filter(sp => sp.psp.isActive && !sp.psp.deletedAt)
            .forEach(sp => previousUniquePspIds.add(sp.psp.id));
        }
      });

      previousPsps = previousUniquePspIds.size;
    } else {
      // Pas de filtre de boutique : compter tous les PSP actifs créés avant la période actuelle
      previousPsps = await this.prisma.psp.count({ 
        where: { 
          isActive: true,
          createdAt: { lt: startDate }
        } 
      });
    }

    const totalOrders = orders.length;
    const successfulPayments = successfulPaymentsData._count;
    const totalRevenue = successfulPaymentsData._sum.amount || 0;

    // Debug: logger les dates et le nombre de paiements (seulement en développement)
    if (process.env.NODE_ENV !== 'production') {
      try {
        console.log('[getOverviewMetrics] Date range:', {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          days,
          period,
          totalPayments,
          successfulPayments,
          totalRevenue
        });
      } catch (err) {
        // Ignorer les erreurs de logging
      }
    }

    // Calculer les métriques de la période précédente
    const previousSuccessfulPayments = previousSuccessfulPaymentsData._count;
    const previousTotalRevenue = previousSuccessfulPaymentsData._sum.amount || 0;

    // Calculer les pourcentages de croissance
    const calculateGrowth = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    return {
      totalStores,
      totalPsps,
      totalOrders,
      totalPayments,
      successfulPayments,
      conversionRate: totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 0,
      totalRevenue,
      growth: {
        stores: calculateGrowth(totalStores, previousStores),
        psps: calculateGrowth(totalPsps, previousPsps),
        payments: calculateGrowth(successfulPayments, previousSuccessfulPayments),
        revenue: calculateGrowth(totalRevenue, previousTotalRevenue)
      }
    };
  }

  /**
   * Métriques par boutique
   */
  async getStoreMetrics(period: 'day' | 'week' | 'month' = 'month', storeIds?: string[], days?: number): Promise<StoreMetric[]> {
    const startDate = days ? new Date(new Date().getTime() - (days * 24 * 60 * 60 * 1000)) : this.getStartDate(period);

    // Construire le filtre pour les stores
    const storeFilter = storeIds && storeIds.length > 0 ? { id: { in: storeIds } } : undefined;

    const stores = await this.prisma.store.findMany({
      where: storeFilter,
      include: {
        orders: {
          where: { createdAt: { gte: startDate } },
          select: { id: true, totalAmount: true, paymentStatus: true }
        },
        psps: {
          select: { id: true }
        }
      }
    });

    return stores.map(store => {
      const totalOrders = store.orders.length;
      const successfulOrders = store.orders.filter(o => o.paymentStatus === 'SUCCESS').length;
      const totalRevenue = store.orders
        .filter(o => o.paymentStatus === 'SUCCESS')
        .reduce((sum, o) => sum + o.totalAmount, 0);

      return {
        id: store.id,
        name: store.name,
        domain: store.domain,
        platform: store.platform,
        totalOrders,
        successfulOrders,
        totalRevenue,
        pspCount: store.psps.length,
        conversionRate: totalOrders > 0 ? (successfulOrders / totalOrders) * 100 : 0
      };
    });
  }

  /**
   * Métriques par PSP
   */
  async getPspMetrics(period: 'day' | 'week' | 'month' = 'month', storeIds?: string[], days?: number): Promise<PspMetric[]> {
    const startDate = days ? new Date(new Date().getTime() - (days * 24 * 60 * 60 * 1000)) : this.getStartDate(period);

    // Construire le filtre pour les paiements
    const paymentFilter: any = { createdAt: { gte: startDate } };
    if (storeIds && storeIds.length > 0) {
      paymentFilter.storeId = { in: storeIds };
    }

    const psps = await this.prisma.psp.findMany({
      where: { isActive: true },
      include: {
        payments: {
          where: paymentFilter,
          select: { amount: true, status: true, processingTimeMs: true }
        }
      }
    });

    return psps.map(psp => {
      const totalPayments = psp.payments.length;
      const successfulPayments = psp.payments.filter(p => p.status === PaymentStatus.SUCCESS).length;
      const totalRevenue = psp.payments
        .filter(p => p.status === PaymentStatus.SUCCESS)
        .reduce((sum, p) => sum + p.amount, 0);
      
      const processingTimes = psp.payments
        .filter(p => p.processingTimeMs)
        .map(p => p.processingTimeMs!);
      
      const avgProcessingTime = processingTimes.length > 0
        ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
        : undefined;

      return {
        id: psp.id,
        pspType: psp.pspType,
        name: psp.name,
        storeName: 'Global', // PSP global, pas lié à une boutique spécifique
        storeId: 'global',
        totalPayments,
        successfulPayments,
        totalRevenue,
        conversionRate: totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 0,
        isActive: psp.isActive,
        avgProcessingTime
      };
    });
  }

  /**
   * Données de tendance pour les graphiques
   */
  async getTrendData(period: 'day' | 'week' | 'month' = 'week', days: number = 7, storeIds?: string[], fromDate?: Date, toDate?: Date): Promise<TrendData[]> {
    // Calculer les dates de début et de fin de manière cohérente avec getOverviewMetrics
    // Toujours utiliser days (qui a une valeur par défaut de 7) pour garantir la cohérence
    const { startDate, endDate } = this.calculateDateRange(days, undefined, fromDate, toDate);

    // Construire le filtre pour les paiements
    const paymentFilter: any = {
      createdAt: { gte: startDate, lte: endDate }
    };
    if (storeIds && storeIds.length > 0) {
      paymentFilter.storeId = { in: storeIds };
    }

    const payments = await this.prisma.payment.findMany({
      where: paymentFilter,
      include: {
        psp: {
          select: { pspType: true, name: true }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Debug: logger les dates et le nombre de paiements (seulement en développement)
    if (process.env.NODE_ENV !== 'production') {
      try {
        const successfulPayments = payments.filter(p => p.status === PaymentStatus.SUCCESS);
        const totalAmount = successfulPayments.reduce((sum, p) => sum + p.amount, 0);
        const paymentsByDate = new Map<string, number>();
        payments.forEach(p => {
          const date = new Date(p.createdAt).toISOString().split('T')[0];
          paymentsByDate.set(date, (paymentsByDate.get(date) || 0) + 1);
        });
        
        console.log('[getTrendData] Date range:', {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          days,
          period,
          paymentsCount: payments.length,
          successfulPayments: successfulPayments.length,
          totalAmount: totalAmount,
          paymentsByDate: Object.fromEntries(paymentsByDate),
          samplePayments: payments.slice(0, 5).map(p => ({
            id: p.id,
            date: p.createdAt.toISOString(),
            amount: p.amount,
            status: p.status
          }))
        });
      } catch (err) {
        // Ignorer les erreurs de logging
      }
    }

    // Grouper par jour
    const dailyData = new Map<string, {
      totalPayments: number;
      successfulPayments: number;
      totalAmount: number;
      successfulAmount: number;
      pspBreakdown: Record<string, { total: number; successful: number; amount: number }>;
    }>();

    payments.forEach(payment => {
      // Utiliser la date locale pour le groupement, pas UTC
      // Cela garantit que les paiements sont groupés selon le fuseau horaire du serveur
      const paymentDate = new Date(payment.createdAt);
      const year = paymentDate.getFullYear();
      const month = String(paymentDate.getMonth() + 1).padStart(2, '0');
      const day = String(paymentDate.getDate()).padStart(2, '0');
      const date = `${year}-${month}-${day}`;
      const pspKey = payment.psp?.pspType || 'unknown';

      if (!dailyData.has(date)) {
        dailyData.set(date, {
          totalPayments: 0,
          successfulPayments: 0,
          totalAmount: 0,
          successfulAmount: 0,
          pspBreakdown: {}
        });
      }

      const dayData = dailyData.get(date)!;
      dayData.totalPayments++;
      dayData.totalAmount += payment.amount;

      if (payment.status === PaymentStatus.SUCCESS) {
        dayData.successfulPayments++;
        dayData.successfulAmount += payment.amount;
      }

      if (!dayData.pspBreakdown[pspKey]) {
        dayData.pspBreakdown[pspKey] = { total: 0, successful: 0, amount: 0 };
      }

      dayData.pspBreakdown[pspKey].total++;
      dayData.pspBreakdown[pspKey].amount += payment.amount;

      if (payment.status === PaymentStatus.SUCCESS) {
        dayData.pspBreakdown[pspKey].successful++;
      }
    });

    // Créer un tableau avec tous les jours de la période (même ceux sans données)
    const allDays: TrendData[] = [];
    const currentDate = new Date(startDate);
    // S'assurer que la date de début est à minuit
    currentDate.setHours(0, 0, 0, 0);
    const endDateCopy = new Date(endDate);
    // S'assurer que la date de fin est à 23h59
    endDateCopy.setHours(23, 59, 59, 999);
    
    // Debug: logger le groupement par date
    if (process.env.NODE_ENV !== 'production') {
      try {
        const dailyDataSummary = Array.from(dailyData.entries()).map(([date, data]) => ({
          date,
          totalPayments: data.totalPayments,
          successfulPayments: data.successfulPayments,
          totalAmount: data.totalAmount,
          successfulAmount: data.successfulAmount
        }));
        console.log('[getTrendData] Groupement par date:', {
          totalDaysInPeriod: Math.ceil((endDateCopy.getTime() - currentDate.getTime()) / (24 * 60 * 60 * 1000)) + 1,
          daysWithData: dailyData.size,
          dailyDataSummary,
          totalSuccessfulAmount: Array.from(dailyData.values()).reduce((sum, d) => sum + d.successfulAmount, 0)
        });
      } catch (err) {
        // Ignorer les erreurs de logging
      }
    }
    
    while (currentDate <= endDateCopy) {
      // Utiliser la date locale pour la correspondance, pas UTC
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const dayData = dailyData.get(dateStr);
      
      if (dayData) {
        allDays.push({
          date: dateStr,
          ...dayData
        });
      } else {
        // Jour sans données : ajouter avec des valeurs à 0
        allDays.push({
          date: dateStr,
          totalPayments: 0,
          successfulPayments: 0,
          totalAmount: 0,
          successfulAmount: 0,
          pspBreakdown: {}
        });
      }
      
      // Passer au jour suivant
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return allDays;
  }

  /**
   * Comparaison des PSP
   */
  async getPspComparison(storeIds?: string[]): Promise<PspComparison[]> {
    // Grouper les PSP par type
    const pspGroups = await this.prisma.psp.groupBy({
      by: ['pspType'],
      where: { isActive: true },
      _count: { id: true }
    });

    const comparisons: PspComparison[] = [];

    // Construire le filtre pour les paiements
    const paymentFilter: any = {};
    if (storeIds && storeIds.length > 0) {
      paymentFilter.storeId = { in: storeIds };
    }

    for (const pspGroup of pspGroups) {
      // Récupérer un échantillon de PSP de ce type pour les métriques
      const samplePsp = await this.prisma.psp.findFirst({
        where: { pspType: pspGroup.pspType },
        include: {
          payments: {
            where: paymentFilter,
            select: { amount: true, status: true }
          }
        }
      });

      if (samplePsp) {
        const totalPayments = samplePsp.payments.length;
        const successfulPayments = samplePsp.payments.filter(p => p.status === PaymentStatus.SUCCESS).length;
        const totalRevenue = samplePsp.payments
          .filter(p => p.status === PaymentStatus.SUCCESS)
          .reduce((sum, p) => sum + p.amount, 0);

        comparisons.push({
          pspType: pspGroup.pspType,
          name: samplePsp.name,
          totalConfigurations: pspGroup._count.id,
          activeConfigurations: pspGroup._count.id, // Tous les PSP actifs
          totalPayments,
          successfulPayments,
          totalRevenue,
          conversionRate: totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 0
        });
      }
    }

    return comparisons;
  }

  /**
   * Métriques détaillées par boutique
   */
  async getStoreDetailedMetrics(storeId: string, period: 'day' | 'week' | 'month' = 'month'): Promise<{
    store: {
      id: string;
      name: string;
      domain: string;
      activePsps: number;
    };
    psps: Array<{
      id: string;
      name: string;
      pspType: string;
      totalPayments: number;
      successfulPayments: number;
      totalRevenue: number;
      conversionRate: number;
      avgProcessingTime?: number;
    }>;
    routing: {
      mode: string;
      fallbackEnabled: boolean;
      maxRetries: number;
      weights: Array<{
        pspName: string;
        weight: number;
      }>;
      fallbackSequence: Array<{
        pspName: string;
        order: number;
      }>;
    };
  }> {
    const startDate = this.getStartDate(period);

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: {
        psps: {
          include: {
            psp: {
              include: {
                payments: {
                  where: {
                    createdAt: { gte: startDate },
                    storeId: storeId // ✅ Filtrer uniquement les paiements de ce store
                  },
                  select: { amount: true, status: true, processingTimeMs: true }
                }
              }
            }
          }
        },
        routingConfig: {
          include: {
            pspWeights: {
              include: {
                psp: { select: { id: true, name: true } }
              }
            },
            fallbackSequence: {
              include: {
                psp: { select: { id: true, name: true } }
              }
            }
          }
        }
      }
    });

    if (!store) {
      throw new Error('Store not found');
    }

    return {
      store: {
        id: store.id,
        name: store.name,
        domain: store.domain,
        activePsps: store.psps.length
      },
      psps: store.psps.map(psp => ({
        id: psp.psp.id, // Utiliser l'ID du PSP global, pas l'ID de la relation
        name: psp.psp.name,
        pspType: psp.psp.pspType,
        totalPayments: psp.psp.payments.length,
        successfulPayments: psp.psp.payments.filter(p => p.status === PaymentStatus.SUCCESS).length,
        totalRevenue: psp.psp.payments
          .filter(p => p.status === PaymentStatus.SUCCESS)
          .reduce((sum, p) => sum + p.amount, 0),
        conversionRate: psp.psp.payments.length > 0 
          ? (psp.psp.payments.filter(p => p.status === PaymentStatus.SUCCESS).length / psp.psp.payments.length) * 100 
          : 0,
        avgProcessingTime: psp.psp.payments.length > 0
          ? psp.psp.payments
              .filter(p => p.processingTimeMs)
              .reduce((sum, p) => sum + p.processingTimeMs!, 0) / psp.psp.payments.length
          : undefined
      })),
      routing: {
        mode: store.routingConfig?.mode || 'AUTOMATIC',
        fallbackEnabled: store.routingConfig?.fallbackEnabled ?? true,
        maxRetries: store.routingConfig?.maxRetries ?? 2,
        weights: store.routingConfig?.pspWeights.map(w => ({
          pspId: w.psp.id, // Utiliser l'ID du PSP global
          pspName: w.psp.name, // Garder le nom pour compatibilité
          weight: w.weight
        })) || [],
        fallbackSequence: store.routingConfig?.fallbackSequence.map(f => ({
          pspId: f.psp.id, // Utiliser l'ID du PSP global
          pspName: f.psp.name, // Garder le nom pour compatibilité
          order: f.order
        })) || []
      }
    };
  }

  private getStartDate(period: 'day' | 'week' | 'month'): Date {
    const now = new Date();
    switch (period) {
      case 'day':
        // 24 dernières heures
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        // 7 derniers jours
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        // 30 derniers jours (fenêtre glissante, pas le 1er du mois)
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  private getPreviousPeriodStartDate(period: 'day' | 'week' | 'month'): Date {
    const now = new Date();
    switch (period) {
      case 'day':
        // 48h à 24h avant maintenant
        return new Date(now.getTime() - 48 * 60 * 60 * 1000);
      case 'week':
        // 14 à 7 jours avant maintenant
        return new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      case 'month':
        // 60 à 30 jours avant maintenant
        return new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    }
  }

  /**
   * Funnel de conversion par boutique
   */
  async getStoreConversionFunnel(storeId: string, period: 'day' | 'week' | 'month' = 'month'): Promise<{
    store: { id: string; name: string; domain: string };
    funnel: {
      checkoutsInitiated: number;
      customerInfoEntered: number;
      paymentInfoStarted: number;
      paymentInfoCompleted: number;
      payButtonClicked: number;
      paymentAttempted: number;
      paymentSuccessful: number;
    };
    conversionRates: {
      customerInfoRate: number;
      paymentStartRate: number;
      paymentCompleteRate: number;
      payButtonRate: number;
      paymentAttemptRate: number;
      finalConversionRate: number;
    };
  }> {
    const startDate = this.getStartDate(period);

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: {
        checkouts: {
          where: { createdAt: { gte: startDate } },
          include: {
            events: {
              orderBy: { createdAt: 'asc' }
            }
          }
        }
      }
    });

    if (!store) {
      throw new Error('Store not found');
    }

    const funnel = {
      checkoutsInitiated: 0,
      customerInfoProgress: 0,
      customerInfoEntered: 0,
      paymentInfoStarted: 0,
      paymentInfoCompleted: 0,
      payButtonClicked: 0,
      paymentAttempted: 0,
      paymentSuccessful: 0,
    };

    store.checkouts.forEach(checkout => {
      const events = checkout.events.map(e => e.step);
      
      if (events.includes('CHECKOUT_INITIATED')) funnel.checkoutsInitiated++;
      if (events.includes('CUSTOMER_INFO_PROGRESS')) funnel.customerInfoProgress++;
      if (events.includes('CUSTOMER_INFO_ENTERED')) funnel.customerInfoEntered++;
      if (events.includes('PAYMENT_INFO_STARTED')) funnel.paymentInfoStarted++;
      if (events.includes('PAYMENT_INFO_COMPLETED')) funnel.paymentInfoCompleted++;
      if (events.includes('PAY_BUTTON_CLICKED')) funnel.payButtonClicked++;
      if (events.includes('PAYMENT_ATTEMPTED')) funnel.paymentAttempted++;
      if (events.includes('PAYMENT_SUCCESSFUL')) funnel.paymentSuccessful++;
    });

    const conversionRates = {
      customerInfoRate: funnel.checkoutsInitiated > 0 ? (funnel.customerInfoEntered / funnel.checkoutsInitiated) * 100 : 0,
      paymentStartRate: funnel.customerInfoEntered > 0 ? (funnel.paymentInfoStarted / funnel.customerInfoEntered) * 100 : 0,
      paymentCompleteRate: funnel.paymentInfoStarted > 0 ? (funnel.paymentInfoCompleted / funnel.paymentInfoStarted) * 100 : 0,
      payButtonRate: funnel.paymentInfoCompleted > 0 ? (funnel.payButtonClicked / funnel.paymentInfoCompleted) * 100 : 0,
      paymentAttemptRate: funnel.payButtonClicked > 0 ? (funnel.paymentAttempted / funnel.payButtonClicked) * 100 : 0,
      finalConversionRate: funnel.paymentAttempted > 0 ? (funnel.paymentSuccessful / funnel.paymentAttempted) * 100 : 0,
    };

    return {
      store: {
        id: store.id,
        name: store.name,
        domain: store.domain,
      },
      funnel,
      conversionRates,
    };
  }

  /**
   * Funnel de conversion global
   */
  async getGlobalConversionFunnel(period: 'day' | 'week' | 'month' = 'month'): Promise<{
    funnel: {
      checkoutsInitiated: number;
      customerInfoEntered: number;
      paymentInfoStarted: number;
      paymentInfoCompleted: number;
      payButtonClicked: number;
      paymentAttempted: number;
      paymentSuccessful: number;
    };
    conversionRates: {
      customerInfoRate: number;
      paymentStartRate: number;
      paymentCompleteRate: number;
      payButtonRate: number;
      paymentAttemptRate: number;
      finalConversionRate: number;
    };
  }> {
    const startDate = this.getStartDate(period);

    const checkouts = await this.prisma.checkout.findMany({
      where: { createdAt: { gte: startDate } },
      include: {
        events: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    const funnel = {
      checkoutsInitiated: 0,
      customerInfoEntered: 0,
      paymentInfoStarted: 0,
      paymentInfoCompleted: 0,
      payButtonClicked: 0,
      paymentAttempted: 0,
      paymentSuccessful: 0,
    };

    checkouts.forEach(checkout => {
      const events = checkout.events.map(e => e.step);
      
      if (events.includes('CHECKOUT_INITIATED')) funnel.checkoutsInitiated++;
      if (events.includes('CUSTOMER_INFO_ENTERED')) funnel.customerInfoEntered++;
      if (events.includes('PAYMENT_INFO_STARTED')) funnel.paymentInfoStarted++;
      if (events.includes('PAYMENT_INFO_COMPLETED')) funnel.paymentInfoCompleted++;
      if (events.includes('PAY_BUTTON_CLICKED')) funnel.payButtonClicked++;
      if (events.includes('PAYMENT_ATTEMPTED')) funnel.paymentAttempted++;
      if (events.includes('PAYMENT_SUCCESSFUL')) funnel.paymentSuccessful++;
    });

    const conversionRates = {
      customerInfoRate: funnel.checkoutsInitiated > 0 ? (funnel.customerInfoEntered / funnel.checkoutsInitiated) * 100 : 0,
      paymentStartRate: funnel.customerInfoEntered > 0 ? (funnel.paymentInfoStarted / funnel.customerInfoEntered) * 100 : 0,
      paymentCompleteRate: funnel.paymentInfoStarted > 0 ? (funnel.paymentInfoCompleted / funnel.paymentInfoStarted) * 100 : 0,
      payButtonRate: funnel.paymentInfoCompleted > 0 ? (funnel.payButtonClicked / funnel.paymentInfoCompleted) * 100 : 0,
      paymentAttemptRate: funnel.payButtonClicked > 0 ? (funnel.paymentAttempted / funnel.payButtonClicked) * 100 : 0,
      finalConversionRate: funnel.paymentAttempted > 0 ? (funnel.paymentSuccessful / funnel.paymentAttempted) * 100 : 0,
    };

    return {
      funnel,
      conversionRates,
    };
  }

  /**
   * Revenus quotidiens pour un store spécifique
   */
  async getStoreDailyRevenue(storeId: string, days: number = 30): Promise<{
    data: Array<{
      date: string;
      revenue: number;
      successfulPayments: number;
      totalPayments: number;
    }>;
    summary: {
      totalRevenue: number;
      averageDailyRevenue: number;
      bestDay: { date: string; revenue: number };
      worstDay: { date: string; revenue: number };
    };
  }> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Récupérer tous les paiements du store sur la période
    const payments = await this.prisma.payment.findMany({
      where: {
        storeId: storeId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        amount: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Grouper par jour
    const dailyData = new Map<string, { revenue: number; successful: number; total: number }>();

    // Initialiser tous les jours avec 0
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      dailyData.set(dateKey, { revenue: 0, successful: 0, total: 0 });
    }

    // Remplir avec les vraies données
    payments.forEach(payment => {
      const dateKey = payment.createdAt.toISOString().split('T')[0];
      const existing = dailyData.get(dateKey) || { revenue: 0, successful: 0, total: 0 };

      existing.total++;
      if (payment.status === PaymentStatus.SUCCESS) {
        existing.revenue += payment.amount / 100; // Convertir centimes en euros
        existing.successful++;
      }

      dailyData.set(dateKey, existing);
    });

    // Convertir en array et trier
    const data = Array.from(dailyData.entries())
      .map(([date, stats]) => ({
        date,
        revenue: Math.round(stats.revenue * 100) / 100, // Arrondir à 2 décimales
        successfulPayments: stats.successful,
        totalPayments: stats.total,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculer le résumé
    const totalRevenue = data.reduce((sum, day) => sum + day.revenue, 0);
    // Moyenne sur les jours avec des paiements uniquement (pas sur toute la période)
    const daysWithRevenue = data.filter(day => day.revenue > 0).length;
    const averageDailyRevenue = daysWithRevenue > 0 ? totalRevenue / daysWithRevenue : 0;

    const bestDay = data.reduce((best, current) =>
      current.revenue > best.revenue ? current : best
    , data[0] || { date: '', revenue: 0 });

    // Worst day parmi les jours avec des paiements uniquement
    const daysWithPayments = data.filter(day => day.revenue > 0);
    const worstDay = daysWithPayments.length > 0
      ? daysWithPayments.reduce((worst, current) =>
          current.revenue < worst.revenue ? current : worst
        , daysWithPayments[0])
      : { date: '', revenue: 0 };

    return {
      data,
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        averageDailyRevenue: Math.round(averageDailyRevenue * 100) / 100,
        bestDay: { date: bestDay.date, revenue: bestDay.revenue },
        worstDay: { date: worstDay.date, revenue: worstDay.revenue },
      },
    };
  }

  /**
   * Checkouts initiés quotidiens pour un store spécifique
   */
  async getStoreDailyCheckouts(storeId: string, days: number = 30): Promise<{
    data: Array<{
      date: string;
      checkoutsInitiated: number;
      customerInfoEntered: number;
      paymentSuccessful: number;
    }>;
    summary: {
      totalCheckouts: number;
      averageDailyCheckouts: number;
      bestDay: { date: string; checkouts: number };
      worstDay: { date: string; checkouts: number };
    };
  }> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Récupérer tous les checkouts du store avec leurs events sur la période
    const checkouts = await this.prisma.checkout.findMany({
      where: {
        storeId: storeId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        events: {
          select: {
            step: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Grouper par jour
    const dailyData = new Map<string, { initiated: number; customerInfo: number; successful: number }>();

    // Initialiser tous les jours avec 0
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      dailyData.set(dateKey, { initiated: 0, customerInfo: 0, successful: 0 });
    }

    // Remplir avec les vraies données
    checkouts.forEach(checkout => {
      const dateKey = checkout.createdAt.toISOString().split('T')[0];
      const existing = dailyData.get(dateKey) || { initiated: 0, customerInfo: 0, successful: 0 };
      const events = checkout.events.map(e => e.step);

      if (events.includes('CHECKOUT_INITIATED')) {
        existing.initiated++;
      }
      if (events.includes('CUSTOMER_INFO_ENTERED')) {
        existing.customerInfo++;
      }
      if (events.includes('PAYMENT_SUCCESSFUL')) {
        existing.successful++;
      }

      dailyData.set(dateKey, existing);
    });

    // Convertir en array et trier
    const data = Array.from(dailyData.entries())
      .map(([date, stats]) => ({
        date,
        checkoutsInitiated: stats.initiated,
        customerInfoEntered: stats.customerInfo,
        paymentSuccessful: stats.successful,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculer le résumé
    const totalCheckouts = data.reduce((sum, day) => sum + day.checkoutsInitiated, 0);
    const daysWithCheckouts = data.filter(day => day.checkoutsInitiated > 0).length;
    const averageDailyCheckouts = daysWithCheckouts > 0 ? totalCheckouts / daysWithCheckouts : 0;

    const bestDay = data.reduce((best, current) =>
      current.checkoutsInitiated > best.checkoutsInitiated ? current : best
    , data[0] || { date: '', checkoutsInitiated: 0 });

    const daysWithData = data.filter(day => day.checkoutsInitiated > 0);
    const worstDay = daysWithData.length > 0
      ? daysWithData.reduce((worst, current) =>
          current.checkoutsInitiated < worst.checkoutsInitiated ? current : worst
        , daysWithData[0])
      : { date: '', checkoutsInitiated: 0 };

    return {
      data,
      summary: {
        totalCheckouts,
        averageDailyCheckouts: Math.round(averageDailyCheckouts * 100) / 100,
        bestDay: { date: bestDay.date, checkouts: bestDay.checkoutsInitiated },
        worstDay: { date: worstDay.date, checkouts: worstDay.checkoutsInitiated },
      },
    };
  }

  /**
   * Approval rate par PSP et global pour un store
   */
  async getStoreApprovalRate(storeId: string, period: 'day' | 'week' | 'month' = 'month'): Promise<{
    global: {
      totalPayments: number;
      successfulPayments: number;
      failedPayments: number;
      approvalRate: number;
    };
    byPsp: Array<{
      pspId: string;
      pspName: string;
      totalPayments: number;
      successfulPayments: number;
      failedPayments: number;
      approvalRate: number;
    }>;
  }> {
    const startDate = this.getStartDate(period);

    // Récupérer tous les paiements du store (uniquement les tentatives réelles à Stripe)
    const payments = await this.prisma.payment.findMany({
      where: {
        storeId: storeId,
        createdAt: { gte: startDate },
        // On compte tous les statuts (SUCCESS, FAILED, etc.)
      },
      include: {
        psp: true,
      },
    });

    // Calcul global
    const totalPayments = payments.length;
    const successfulPayments = payments.filter(p => p.status === PaymentStatus.SUCCESS).length;
    const failedPayments = totalPayments - successfulPayments;
    const globalApprovalRate = totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 0;

    // Grouper par PSP
    const pspMap = new Map<string, {
      pspId: string;
      pspName: string;
      total: number;
      successful: number;
      failed: number;
    }>();

    for (const payment of payments) {
      const pspId = payment.pspId;
      const pspName = payment.psp?.name || 'Unknown';

      // Ignorer les paiements sans PSP
      if (!pspId) {
        continue;
      }

      if (!pspMap.has(pspId)) {
        pspMap.set(pspId, {
          pspId,
          pspName,
          total: 0,
          successful: 0,
          failed: 0,
        });
      }

      const pspStats = pspMap.get(pspId)!;
      pspStats.total++;

      if (payment.status === PaymentStatus.SUCCESS) {
        pspStats.successful++;
      } else {
        pspStats.failed++;
      }
    }

    // Convertir en array avec approval rate
    const byPsp = Array.from(pspMap.values()).map(psp => ({
      pspId: psp.pspId,
      pspName: psp.pspName,
      totalPayments: psp.total,
      successfulPayments: psp.successful,
      failedPayments: psp.failed,
      approvalRate: psp.total > 0 ? (psp.successful / psp.total) * 100 : 0,
    })).sort((a, b) => b.totalPayments - a.totalPayments); // Trier par volume

    return {
      global: {
        totalPayments,
        successfulPayments,
        failedPayments,
        approvalRate: globalApprovalRate,
      },
      byPsp,
    };
  }

  /**
   * Récupérer les PSP avec leur usage du jour ouvrable (depuis 6h Paris) et capacité, paiements et revenus
   * Si storeIds est fourni et contient un seul store, retourner les PSP de ce store (via liste ou directement)
   */
  async getPspsWithUsage(storeIds?: string[], period: 'day' | 'week' | 'month' = 'month', days?: number): Promise<Array<{
    id: string;
    name: string;
    pspType: string;
    usageBusinessDay: number; // Usage depuis 6h Paris (jour ouvrable)
    capacity: number | null; // dailyCapacityEur
    isActive: boolean;
    totalPayments: number;
    totalRevenue: number;
  }>> {
    const sinceBusinessDay = getBusinessDayStartUTC();
    const startDate = days ? new Date(new Date().getTime() - (days * 24 * 60 * 60 * 1000)) : this.getStartDate(period);

    // Construire le filtre pour les paiements selon la période
    const paymentFilter: any = { createdAt: { gte: startDate } };
    if (storeIds && storeIds.length > 0) {
      paymentFilter.storeId = { in: storeIds };
    }

    // Si des stores sont sélectionnés, récupérer uniquement leurs PSP
    if (storeIds && storeIds.length > 0) {
      // Récupérer les stores avec leurs listes de PSP
      const stores = await this.prisma.store.findMany({
        where: { id: { in: storeIds } },
        include: {
          pspList: {
            include: {
              items: {
                include: {
                  psp: true,
                },
                orderBy: { order: 'asc' },
              },
            },
          },
          psps: {
            include: {
              psp: true,
            },
          },
        },
      });

      if (stores.length === 0) {
        return [];
      }

      // Collecter tous les PSP uniques de toutes les boutiques sélectionnées
      const uniquePspIds = new Set<string>();

      stores.forEach(store => {
        // Si le store utilise une liste de PSP
        if (store.pspList) {
          store.pspList.items
            .filter(item => item.psp.isActive && !item.psp.deletedAt)
            .forEach(item => uniquePspIds.add(item.psp.id));
        } else {
          // Sinon, utiliser les PSP directement liés
          store.psps
            .filter(sp => sp.psp.isActive && !sp.psp.deletedAt)
            .forEach(sp => uniquePspIds.add(sp.psp.id));
        }
      });

      const pspIds = Array.from(uniquePspIds);

      if (pspIds.length === 0) {
        return [];
      }

      // Récupérer les PSP avec leur usage
      const psps = await this.prisma.psp.findMany({
        where: { id: { in: pspIds } },
      });

      const pspsWithUsage = await Promise.all(
        psps.map(async (psp) => {
          const [usageBusinessDay, payments] = await Promise.all([
            this.prisma.payment.aggregate({
              where: {
                pspId: psp.id,
                status: PaymentStatus.SUCCESS,
                createdAt: { gte: sinceBusinessDay },
              },
              _sum: { amount: true },
            }),
            this.prisma.payment.findMany({
              where: {
                ...paymentFilter,
                pspId: psp.id,
              },
              select: { amount: true, status: true },
            }),
          ]);

          const totalPayments = payments.length;
          const totalRevenue = payments
            .filter(p => p.status === PaymentStatus.SUCCESS)
            .reduce((sum, p) => sum + p.amount, 0);

          return {
            id: psp.id,
            name: psp.name,
            pspType: psp.pspType,
            usageBusinessDay: usageBusinessDay._sum.amount || 0,
            capacity: psp.dailyCapacityEur,
            isActive: psp.isActive,
            totalPayments,
            totalRevenue,
          };
        })
      );

      return pspsWithUsage;
    }

    // Sinon, retourner tous les PSP actifs (non archivés)
    const psps = await this.prisma.psp.findMany({
      where: { isActive: true, deletedAt: null },
    });

    const pspsWithUsage = await Promise.all(
      psps.map(async (psp) => {
        const [usageBusinessDay, payments] = await Promise.all([
          this.prisma.payment.aggregate({
            where: {
              pspId: psp.id,
              status: PaymentStatus.SUCCESS,
              createdAt: { gte: sinceBusinessDay },
            },
            _sum: { amount: true },
          }),
          this.prisma.payment.findMany({
            where: {
              ...paymentFilter,
              pspId: psp.id,
            },
            select: { amount: true, status: true },
          }),
        ]);

        const totalPayments = payments.length;
        const totalRevenue = payments
          .filter(p => p.status === PaymentStatus.SUCCESS)
          .reduce((sum, p) => sum + p.amount, 0);

        return {
          id: psp.id,
          name: psp.name,
          pspType: psp.pspType,
          usageBusinessDay: usageBusinessDay._sum.amount || 0,
          capacity: psp.dailyCapacityEur,
          isActive: psp.isActive,
          totalPayments,
          totalRevenue,
        };
      })
    );

    return pspsWithUsage;
  }

  /**
   * Récupérer les taux d'approbation quotidiens
   * Pour les approval rates récurrents, on considère les paiements avec attemptNumber > 1 ou isFallback = true
   */
  async getApprovalRates(
    storeIds?: string[],
    days?: number,
    fromDate?: Date,
    toDate?: Date
  ): Promise<{
    approvalRates: Array<{
      date: string;
      totalPayments: number;
      successfulPayments: number;
      approvalRate: number;
    }>;
    recurringApprovalRates: Array<{
      date: string;
      totalPayments: number;
      successfulPayments: number;
      approvalRate: number;
    }>;
    globalApprovalRate: number;
    globalRecurringApprovalRate: number;
  }> {
    // Calculer la période
    let startDate: Date;
    let endDate: Date = new Date();
    endDate.setHours(23, 59, 59, 999);

    if (fromDate && toDate) {
      startDate = new Date(fromDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
    } else if (days) {
      startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
    }

    // Construire le filtre
    const paymentFilter: any = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (storeIds && storeIds.length > 0) {
      paymentFilter.storeId = { in: storeIds };
    }

    // Récupérer tous les paiements
    const allPayments = await this.prisma.payment.findMany({
      where: paymentFilter,
    });

    // Récupérer tous les paiements d'abord pour filtrer ceux qui sont des retries/fallbacks/rebilling
    const allPaymentsForRecurring = await this.prisma.payment.findMany({
      where: paymentFilter,
    });

    // Filtrer les paiements récurrents/retries :
    // - attemptNumber > 1 (tentatives de retry)
    // - isFallback = true (paiements de fallback)
    // - rebilling dans pspMetadata (paiements de rebilling automatique)
    const recurringPayments = allPaymentsForRecurring.filter(payment => {
      if (payment.attemptNumber > 1 || payment.isFallback) {
        return true;
      }
      // Vérifier si c'est un paiement de rebilling dans les métadonnées
      if (payment.pspMetadata && typeof payment.pspMetadata === 'object') {
        const metadata = payment.pspMetadata as any;
        if (metadata.rebilling === true) {
          return true;
        }
      }
      return false;
    });

    // Debug: logger les statistiques des paiements récurrents
    if (process.env.NODE_ENV !== 'production') {
      try {
        const retryCount = allPaymentsForRecurring.filter(p => p.attemptNumber > 1).length;
        const fallbackCount = allPaymentsForRecurring.filter(p => p.isFallback).length;
        const rebillingCount = allPaymentsForRecurring.filter(p => {
          if (p.pspMetadata && typeof p.pspMetadata === 'object') {
            const metadata = p.pspMetadata as any;
            return metadata.rebilling === true;
          }
          return false;
        }).length;
        
        console.log('[getApprovalRates] Statistiques des paiements récurrents:', {
          totalPayments: allPaymentsForRecurring.length,
          recurringPayments: recurringPayments.length,
          retryPayments: retryCount,
          fallbackPayments: fallbackCount,
          rebillingPayments: rebillingCount,
          samplePayments: allPaymentsForRecurring.slice(0, 5).map(p => ({
            id: p.id,
            attemptNumber: p.attemptNumber,
            isFallback: p.isFallback,
            hasRebilling: p.pspMetadata && typeof p.pspMetadata === 'object' && (p.pspMetadata as any).rebilling === true,
            status: p.status,
            date: p.createdAt
          }))
        });
      } catch (err) {
        // Ignorer les erreurs de logging
      }
    }

    // Grouper par jour pour approval rates normaux
    const dailyApprovalData = new Map<string, {
      total: number;
      successful: number;
    }>();

    allPayments.forEach(payment => {
      // Utiliser la date locale pour le groupement, pas UTC (cohérent avec getTrendData)
      const paymentDate = new Date(payment.createdAt);
      const year = paymentDate.getFullYear();
      const month = String(paymentDate.getMonth() + 1).padStart(2, '0');
      const day = String(paymentDate.getDate()).padStart(2, '0');
      const date = `${year}-${month}-${day}`;
      
      if (!dailyApprovalData.has(date)) {
        dailyApprovalData.set(date, { total: 0, successful: 0 });
      }
      const dayData = dailyApprovalData.get(date)!;
      dayData.total++;
      if (payment.status === PaymentStatus.SUCCESS) {
        dayData.successful++;
      }
    });

    // Grouper par jour pour recurring approval rates
    const dailyRecurringData = new Map<string, {
      total: number;
      successful: number;
    }>();

    recurringPayments.forEach(payment => {
      // Utiliser la date locale pour le groupement, pas UTC (cohérent avec getTrendData)
      const paymentDate = new Date(payment.createdAt);
      const year = paymentDate.getFullYear();
      const month = String(paymentDate.getMonth() + 1).padStart(2, '0');
      const day = String(paymentDate.getDate()).padStart(2, '0');
      const date = `${year}-${month}-${day}`;
      
      if (!dailyRecurringData.has(date)) {
        dailyRecurringData.set(date, { total: 0, successful: 0 });
      }
      const dayData = dailyRecurringData.get(date)!;
      dayData.total++;
      if (payment.status === PaymentStatus.SUCCESS) {
        dayData.successful++;
      }
    });

    // Créer un tableau avec tous les jours de la période
    const approvalRates: Array<{
      date: string;
      totalPayments: number;
      successfulPayments: number;
      approvalRate: number;
    }> = [];

    const recurringApprovalRates: Array<{
      date: string;
      totalPayments: number;
      successfulPayments: number;
      approvalRate: number;
    }> = [];

    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);
    const endDateCopy = new Date(endDate);
    endDateCopy.setHours(23, 59, 59, 999);
    
    while (currentDate <= endDateCopy) {
      // Utiliser la date locale pour la correspondance, pas UTC (cohérent avec getTrendData)
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const approvalData = dailyApprovalData.get(dateStr);
      const recurringData = dailyRecurringData.get(dateStr);

      // Approval rates normaux
      if (approvalData && approvalData.total > 0) {
        approvalRates.push({
          date: dateStr,
          totalPayments: approvalData.total,
          successfulPayments: approvalData.successful,
          approvalRate: (approvalData.successful / approvalData.total) * 100,
        });
      } else {
        approvalRates.push({
          date: dateStr,
          totalPayments: 0,
          successfulPayments: 0,
          approvalRate: 0,
        });
      }

      // Recurring approval rates
      if (recurringData && recurringData.total > 0) {
        recurringApprovalRates.push({
          date: dateStr,
          totalPayments: recurringData.total,
          successfulPayments: recurringData.successful,
          approvalRate: (recurringData.successful / recurringData.total) * 100,
        });
      } else {
        recurringApprovalRates.push({
          date: dateStr,
          totalPayments: 0,
          successfulPayments: 0,
          approvalRate: 0,
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Calculer les taux globaux
    const totalAllPayments = allPayments.length;
    const successfulAllPayments = allPayments.filter(p => p.status === PaymentStatus.SUCCESS).length;
    const globalApprovalRate = totalAllPayments > 0 
      ? (successfulAllPayments / totalAllPayments) * 100 
      : 0;

    const totalRecurringPayments = recurringPayments.length;
    const successfulRecurringPayments = recurringPayments.filter(p => p.status === PaymentStatus.SUCCESS).length;
    const globalRecurringApprovalRate = totalRecurringPayments > 0 
      ? (successfulRecurringPayments / totalRecurringPayments) * 100 
      : 0;

    // Debug: logger les données calculées
    if (process.env.NODE_ENV !== 'production') {
      try {
        const approvalRatesWithData = approvalRates.filter(r => r.totalPayments > 0);
        const totalFromDaily = approvalRatesWithData.reduce((sum, r) => sum + r.totalPayments, 0);
        const successfulFromDaily = approvalRatesWithData.reduce((sum, r) => sum + r.successfulPayments, 0);
        
        console.log('[getApprovalRates] Données calculées:', {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          days,
          storeIds,
          totalAllPayments,
          successfulAllPayments,
          globalApprovalRate,
          totalFromDaily,
          successfulFromDaily,
          daysWithData: approvalRatesWithData.length,
          approvalRatesWithData: approvalRatesWithData.map(r => ({
            date: r.date,
            totalPayments: r.totalPayments,
            successfulPayments: r.successfulPayments,
            approvalRate: r.approvalRate
          }))
        });
      } catch (err) {
        // Ignorer les erreurs de logging
      }
    }

    return {
      approvalRates,
      recurringApprovalRates,
      globalApprovalRate,
      globalRecurringApprovalRate,
    };
  }

  /**
   * Récupérer les détails complets d'un PSP avec ses métriques
   */
  async getPspDetails(pspId: string): Promise<{
    psp: any;
    lifetimeMetrics: {
      totalAttempts: number;
      successful: number;
      failed: number;
      totalVolume: number;
      successVolume: number;
      declineVolume: number;
      approvalRate: number;
      avgTransaction: number;
    };
    thisMonthMetrics: {
      totalAttempts: number;
      successful: number;
      failed: number;
      totalVolume: number;
      successVolume: number;
      declineVolume: number;
      approvalRate: number;
      volumePerDay: number;
    };
    keyRatios: {
      totalAttempts: number;
      avgTransaction: number;
      successful: number;
      volumePerDay: number;
      failed: number;
    };
    stripeAccountDetails?: {
      accountId: string;
      businessName: string | null;
      businessType: string | null;
      country: string | null;
      defaultCurrency: string | null;
      chargesEnabled: boolean;
      payoutsEnabled: boolean;
      detailsSubmitted: boolean;
      mode: 'live' | 'test';
    };
  }> {
    // Récupérer le PSP
    const psp = await this.prisma.psp.findUnique({
      where: { id: pspId },
    });

    if (!psp) {
      throw new Error('PSP not found');
    }

    // Calculer les dates
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Récupérer tous les paiements pour ce PSP (lifetime)
    const allPayments = await this.prisma.payment.findMany({
      where: { pspId: psp.id },
      select: { amount: true, status: true },
    });

    // Récupérer les paiements de ce mois
    const thisMonthPayments = await this.prisma.payment.findMany({
      where: {
        pspId: psp.id,
        createdAt: { gte: startOfMonth },
      },
      select: { amount: true, status: true },
    });

    // Calculer les métriques lifetime
    const lifetimeTotalAttempts = allPayments.length;
    const lifetimeSuccessful = allPayments.filter(p => p.status === PaymentStatus.SUCCESS).length;
    const lifetimeFailed = lifetimeTotalAttempts - lifetimeSuccessful;
    const lifetimeTotalVolume = allPayments.reduce((sum, p) => sum + p.amount, 0);
    const lifetimeSuccessVolume = allPayments
      .filter(p => p.status === PaymentStatus.SUCCESS)
      .reduce((sum, p) => sum + p.amount, 0);
    const lifetimeDeclineVolume = lifetimeTotalVolume - lifetimeSuccessVolume;
    const lifetimeApprovalRate = lifetimeTotalAttempts > 0 
      ? (lifetimeSuccessful / lifetimeTotalAttempts) * 100 
      : 0;
    const lifetimeAvgTransaction = lifetimeSuccessful > 0 
      ? lifetimeSuccessVolume / lifetimeSuccessful 
      : 0;

    // Calculer les métriques ce mois
    const thisMonthTotalAttempts = thisMonthPayments.length;
    const thisMonthSuccessful = thisMonthPayments.filter(p => p.status === PaymentStatus.SUCCESS).length;
    const thisMonthFailed = thisMonthTotalAttempts - thisMonthSuccessful;
    const thisMonthTotalVolume = thisMonthPayments.reduce((sum, p) => sum + p.amount, 0);
    const thisMonthSuccessVolume = thisMonthPayments
      .filter(p => p.status === PaymentStatus.SUCCESS)
      .reduce((sum, p) => sum + p.amount, 0);
    const thisMonthDeclineVolume = thisMonthTotalVolume - thisMonthSuccessVolume;
    const thisMonthApprovalRate = thisMonthTotalAttempts > 0 
      ? (thisMonthSuccessful / thisMonthTotalAttempts) * 100 
      : 0;
    const daysInMonth = now.getDate();
    const thisMonthVolumePerDay = daysInMonth > 0 
      ? thisMonthSuccessVolume / daysInMonth 
      : 0;

    // Key ratios (utiliser les métriques lifetime pour avgTransaction, sinon 0)
    const keyRatios = {
      totalAttempts: thisMonthTotalAttempts,
      avgTransaction: lifetimeAvgTransaction,
      successful: thisMonthSuccessful,
      volumePerDay: thisMonthVolumePerDay,
      failed: thisMonthFailed,
    };

    // Si c'est un PSP Stripe, récupérer les détails du compte
    let stripeAccountDetails: any = undefined;
    if (psp.pspType === 'stripe' && psp.secretKey) {
      try {
        // Déchiffrer les credentials
        const decryptedCredentials = decryptPSPCredentials({
          publicKey: psp.publicKey,
          secretKey: psp.secretKey,
        });
        
        const Stripe = require('stripe');
        const stripe = new Stripe(decryptedCredentials.secretKey);
        const account = await stripe.accounts.retrieve();
        
        stripeAccountDetails = {
          accountId: account.id,
          businessName: account.business_profile?.name || null,
          businessType: account.business_type || null,
          country: account.country || null,
          defaultCurrency: account.default_currency || null,
          chargesEnabled: account.charges_enabled || false,
          payoutsEnabled: account.payouts_enabled || false,
          detailsSubmitted: account.details_submitted || false,
          mode: account.id.startsWith('acct_') ? 'live' : 'test',
        };

        // Mettre à jour le cache en DB
        await this.prisma.psp.update({
          where: { id: pspId },
          data: {
            stripeChargesEnabled: account.charges_enabled || false,
            stripePayoutsEnabled: account.payouts_enabled || false,
            lastStripeCheck: new Date(),
          },
        });
      } catch (error) {
        console.error(`Failed to fetch Stripe account details for PSP ${pspId}:`, error);
        // Ne pas faire échouer la requête si Stripe échoue
      }
    }

    return {
      psp: {
        id: psp.id,
        name: psp.name,
        pspType: psp.pspType,
        publicKey: psp.publicKey,
        monthlyCapacityEur: psp.monthlyCapacityEur,
        dailyCapacityEur: psp.dailyCapacityEur,
        isActive: psp.isActive,
        stripeChargesEnabled: psp.stripeChargesEnabled,
        createdAt: psp.createdAt,
        updatedAt: psp.updatedAt,
      },
      lifetimeMetrics: {
        totalAttempts: lifetimeTotalAttempts,
        successful: lifetimeSuccessful,
        failed: lifetimeFailed,
        totalVolume: lifetimeTotalVolume,
        successVolume: lifetimeSuccessVolume,
        declineVolume: lifetimeDeclineVolume,
        approvalRate: lifetimeApprovalRate,
        avgTransaction: lifetimeAvgTransaction,
      },
      thisMonthMetrics: {
        totalAttempts: thisMonthTotalAttempts,
        successful: thisMonthSuccessful,
        failed: thisMonthFailed,
        totalVolume: thisMonthTotalVolume,
        successVolume: thisMonthSuccessVolume,
        declineVolume: thisMonthDeclineVolume,
        approvalRate: thisMonthApprovalRate,
        volumePerDay: thisMonthVolumePerDay,
      },
      keyRatios,
      stripeAccountDetails,
    };
  }

  /**
   * Récupérer les données d'usage quotidien pour un PSP
   * Retourne l'usage réel, l'usage 24h/cap, et l'usage 30j/cap
   */
  async getPspUsageTrend(
    pspId: string,
    days?: number,
    fromDate?: Date,
    toDate?: Date
  ): Promise<Array<{
    date: string;
    usageReal: number; // Usage réel du jour (en centimes)
    usage24hCapPercent: number; // Pourcentage de la capacité quotidienne
    usage30jCapPercent: number; // Pourcentage de la capacité mensuelle
    dailyCapacity: number | null; // Capacité quotidienne en centimes pour ce jour
    monthlyCapacity: number | null; // Capacité mensuelle en centimes pour ce jour
  }>> {
    const psp = await this.prisma.psp.findUnique({
      where: { id: pspId },
      select: {
        dailyCapacityEur: true,
        monthlyCapacityEur: true,
        updatedAt: true,
      },
    });

    if (!psp) {
      throw new Error(`PSP ${pspId} not found`);
    }

    const now = new Date();
    let endDate: Date;
    let startDate: Date;

    if (fromDate && toDate) {
      // Période personnalisée
      startDate = new Date(fromDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
    } else if (days !== undefined && days !== null) {
      // Nombre de jours spécifié
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
    } else {
      // Par défaut : 30 jours
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    }

    // Récupérer tous les paiements réussis sur les 30 derniers jours
    const payments = await this.prisma.payment.findMany({
      where: {
        pspId: pspId,
        status: PaymentStatus.SUCCESS,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        amount: true,
        createdAt: true,
      },
    });

    // Grouper par jour (en utilisant la date locale)
    const dailyUsage: Record<string, number> = {};
    payments.forEach(payment => {
      const paymentDate = new Date(payment.createdAt);
      const year = paymentDate.getFullYear();
      const month = String(paymentDate.getMonth() + 1).padStart(2, '0');
      const day = String(paymentDate.getDate()).padStart(2, '0');
      const date = `${year}-${month}-${day}`;
      dailyUsage[date] = (dailyUsage[date] || 0) + payment.amount;
    });

    // Calculer l'usage glissant 24h et 30j pour chaque jour
    const result: Array<{
      date: string;
      usageReal: number;
      usage24hCapPercent: number;
      usage30jCapPercent: number;
      dailyCapacity: number | null;
      monthlyCapacity: number | null;
    }> = [];

    // Les capacités actuelles (affichées pour toutes les dates si elles existent)
    const currentDailyCapacity = psp.dailyCapacityEur || null;
    const currentMonthlyCapacity = psp.monthlyCapacityEur || null;
    
    console.log(`[getPspUsageTrend] PSP ${pspId} capacities:`, {
      dailyCapacityEur: psp.dailyCapacityEur,
      monthlyCapacityEur: psp.monthlyCapacityEur,
      currentDailyCapacity,
      currentMonthlyCapacity,
      dailyCapacityInEuros: currentDailyCapacity ? currentDailyCapacity / 100 : null,
      monthlyCapacityInEuros: currentMonthlyCapacity ? currentMonthlyCapacity / 100 : null
    });

    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      // Usage réel du jour
      const usageReal = dailyUsage[dateStr] || 0;

      // Fin du jour (23:59:59)
      const endOfDay = new Date(currentDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Afficher les capacités actuelles pour toutes les dates (elles sont constantes)
      // Si la capacité existe, on l'affiche pour toutes les dates de la période
      const dailyCapacity = currentDailyCapacity;
      const monthlyCapacity = currentMonthlyCapacity;

      // Calculer l'usage glissant 24h (fenêtre glissante de 24h avant la fin de ce jour)
      const since24h = new Date(endOfDay);
      since24h.setTime(since24h.getTime() - (24 * 60 * 60 * 1000));
      const usage24h = payments
        .filter(p => {
          const pDate = new Date(p.createdAt);
          return pDate >= since24h && pDate <= endOfDay;
        })
        .reduce((sum, p) => sum + p.amount, 0);

      // Calculer l'usage glissant 30j (fenêtre glissante de 30 jours avant la fin de ce jour)
      const since30j = new Date(endOfDay);
      since30j.setDate(since30j.getDate() - 30);
      since30j.setHours(0, 0, 0, 0);
      const usage30j = payments
        .filter(p => {
          const pDate = new Date(p.createdAt);
          return pDate >= since30j && pDate <= endOfDay;
        })
        .reduce((sum, p) => sum + p.amount, 0);

      // Calculer les pourcentages
      const usage24hCapPercent = dailyCapacity && dailyCapacity > 0 
        ? Math.min(100, (usage24h / dailyCapacity) * 100)
        : 0;

      const usage30jCapPercent = monthlyCapacity && monthlyCapacity > 0
        ? Math.min(100, (usage30j / monthlyCapacity) * 100)
        : 0;

      result.push({
        date: dateStr,
        usageReal,
        usage24hCapPercent,
        usage30jCapPercent,
        dailyCapacity,
        monthlyCapacity,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }

  /**
   * Récupérer les fonds à venir (pending balance) pour un PSP Stripe
   * Retourne les montants groupés par date de disponibilité et par devise
   *
   * Utilise un cache de 3h : si les données ont moins de 3h, retourne le cache DB
   * sans appeler Stripe. Sinon, appelle Stripe et met à jour le cache.
   */
  async getPspUpcomingFunds(pspId: string): Promise<{
    upcomingFunds: Array<{
      availableOn: string; // Date ISO
      currency: string;
      amount: number; // En centimes
      transactionCount: number;
    }>;
    currentBalance: {
      available: Array<{ currency: string; amount: number }>;
      pending: Array<{ currency: string; amount: number }>;
    } | null;
    pspType: string;
    fromCache: boolean;
    lastUpdated: Date | null;
  }> {
    const CACHE_DURATION_MS = 3 * 60 * 60 * 1000; // 3 heures

    // Récupérer le PSP
    const psp = await this.prisma.psp.findUnique({
      where: { id: pspId },
    });

    if (!psp) {
      throw new Error('PSP not found');
    }

    // Seul Stripe supporte cette fonctionnalité pour l'instant
    if (psp.pspType !== 'stripe' || !psp.secretKey) {
      return {
        upcomingFunds: [],
        currentBalance: null,
        pspType: psp.pspType,
        fromCache: false,
        lastUpdated: null,
      };
    }

    // Vérifier si le cache est valide (moins de 3h)
    const now = new Date();
    const cacheIsValid = psp.balanceLastUpdated &&
      (now.getTime() - psp.balanceLastUpdated.getTime()) < CACHE_DURATION_MS;

    if (cacheIsValid) {
      console.log(`[getPspUpcomingFunds] Using cached data for PSP ${psp.name} (last updated: ${psp.balanceLastUpdated})`);

      // Récupérer les upcomingFunds depuis le cache
      const cachedRawData = psp.balanceRawData as {
        available?: Array<{ currency: string; amount: number }>;
        pending?: Array<{ currency: string; amount: number }>;
        upcomingFunds?: Array<{
          availableOn: string;
          currency: string;
          amount: number;
          transactionCount: number;
        }>;
      } | null;

      // Retourner les données du cache DB
      return {
        upcomingFunds: cachedRawData?.upcomingFunds || [],
        currentBalance: {
          available: cachedRawData?.available || [{ currency: 'EUR', amount: psp.balanceAvailableEur || 0 }],
          pending: cachedRawData?.pending || [{ currency: 'EUR', amount: psp.balancePendingEur || 0 }],
        },
        pspType: psp.pspType,
        fromCache: true,
        lastUpdated: psp.balanceLastUpdated,
      };
    }

    console.log(`[getPspUpcomingFunds] Cache expired or missing for PSP ${psp.name}, fetching from Stripe...`);

    try {
      // Déchiffrer les credentials
      const decryptedCredentials = decryptPSPCredentials({
        publicKey: psp.publicKey,
        secretKey: psp.secretKey,
      });

      const Stripe = require('stripe');
      const stripe = new Stripe(decryptedCredentials.secretKey);

      // Récupérer la balance actuelle
      const balance = await stripe.balance.retrieve();

      // Extraire les montants EUR pour le cache
      const availableEur = balance.available.find((b: any) => b.currency.toLowerCase() === 'eur')?.amount || 0;
      const pendingEur = balance.pending.find((b: any) => b.currency.toLowerCase() === 'eur')?.amount || 0;

      // Récupérer les transactions pending pour avoir les dates available_on
      const pendingTransactions = await stripe.balanceTransactions.list({
        limit: 100,
        created: {
          gte: Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30, // 30 derniers jours
        },
      });

      // Filtrer les transactions qui ne sont pas encore disponibles pour retrait
      // Note: on ne filtre PAS sur status === 'pending' car les fonds "pending" dans la balance
      // correspondent à des transactions avec available_on dans le futur, peu importe leur status
      const nowTimestamp = Math.floor(Date.now() / 1000);
      const futureTransactions = pendingTransactions.data.filter(
        (tx: any) => tx.available_on > nowTimestamp && tx.amount > 0
      );

      console.log(`[getPspUpcomingFunds] Found ${pendingTransactions.data.length} total transactions, ${futureTransactions.length} with future available_on`);

      // Grouper par date et par devise
      const groupedByDateAndCurrency: Record<string, Record<string, { amount: number; count: number }>> = {};

      for (const tx of futureTransactions) {
        const availableDate = new Date(tx.available_on * 1000).toISOString().split('T')[0];
        const currency = tx.currency.toUpperCase();

        if (!groupedByDateAndCurrency[availableDate]) {
          groupedByDateAndCurrency[availableDate] = {};
        }
        if (!groupedByDateAndCurrency[availableDate][currency]) {
          groupedByDateAndCurrency[availableDate][currency] = { amount: 0, count: 0 };
        }

        groupedByDateAndCurrency[availableDate][currency].amount += tx.amount;
        groupedByDateAndCurrency[availableDate][currency].count += 1;
      }

      // Transformer en tableau et trier par date
      const upcomingFunds: Array<{
        availableOn: string;
        currency: string;
        amount: number;
        transactionCount: number;
      }> = [];

      for (const [date, currencies] of Object.entries(groupedByDateAndCurrency)) {
        for (const [currency, data] of Object.entries(currencies)) {
          upcomingFunds.push({
            availableOn: date,
            currency,
            amount: data.amount,
            transactionCount: data.count,
          });
        }
      }

      // Trier par date puis par devise
      upcomingFunds.sort((a, b) => {
        const dateCompare = a.availableOn.localeCompare(b.availableOn);
        if (dateCompare !== 0) return dateCompare;
        return a.currency.localeCompare(b.currency);
      });

      // Préparer les données de balance formatées
      const availableBalances = balance.available.map((b: any) => ({
        currency: b.currency.toUpperCase(),
        amount: b.amount,
      }));
      const pendingBalances = balance.pending.map((b: any) => ({
        currency: b.currency.toUpperCase(),
        amount: b.amount,
      }));

      // Mettre à jour le cache en DB (incluant les upcomingFunds)
      await this.prisma.psp.update({
        where: { id: pspId },
        data: {
          balanceAvailableEur: availableEur,
          balancePendingEur: pendingEur,
          balanceRawData: {
            available: availableBalances,
            pending: pendingBalances,
            upcomingFunds: upcomingFunds,
          },
          balanceLastUpdated: now,
        },
      });

      console.log(`[getPspUpcomingFunds] Updated cache for PSP ${psp.name}: ${availableEur / 100} EUR available, ${pendingEur / 100} EUR pending, ${upcomingFunds.length} upcoming entries`);

      return {
        upcomingFunds,
        currentBalance: {
          available: availableBalances,
          pending: pendingBalances,
        },
        pspType: psp.pspType,
        fromCache: false,
        lastUpdated: now,
      };
    } catch (error) {
      console.error(`Failed to fetch upcoming funds for PSP ${pspId}:`, error);

      // En cas d'erreur, retourner le cache existant s'il y en a un
      if (psp.balanceLastUpdated) {
        const cachedRawData = psp.balanceRawData as {
          available?: Array<{ currency: string; amount: number }>;
          pending?: Array<{ currency: string; amount: number }>;
          upcomingFunds?: Array<{
            availableOn: string;
            currency: string;
            amount: number;
            transactionCount: number;
          }>;
        } | null;

        return {
          upcomingFunds: cachedRawData?.upcomingFunds || [],
          currentBalance: {
            available: cachedRawData?.available || [{ currency: 'EUR', amount: psp.balanceAvailableEur || 0 }],
            pending: cachedRawData?.pending || [{ currency: 'EUR', amount: psp.balancePendingEur || 0 }],
          },
          pspType: psp.pspType,
          fromCache: true,
          lastUpdated: psp.balanceLastUpdated,
        };
      }

      return {
        upcomingFunds: [],
        currentBalance: null,
        pspType: psp.pspType,
        fromCache: false,
        lastUpdated: null,
      };
    }
  }
}