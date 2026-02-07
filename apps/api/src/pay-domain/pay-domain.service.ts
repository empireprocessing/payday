import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PayDomainStatus } from '@prisma/client';
import { ExternalDomainService } from './external-domain.service';

export interface CreatePayDomainDto {
  hostname: string;
}

export interface PayDomainResponse {
  id: string;
  hostname: string;
  status: PayDomainStatus;
  lastError?: string;
  cloudflareHostnameId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DnsRecords {
  cname: {
    host: string;
    target: string;
  };
  acmeCname: {
    host: string;
    target: string;
  };
  ownershipVerification?: {
    name: string;
    type: string;
    value: string;
  };
}

@Injectable()
export class PayDomainService {
  constructor(
    private prisma: PrismaService,
    private externalDomainService: ExternalDomainService
  ) {}

  async createPayDomain(storeId: string, dto: CreatePayDomainDto): Promise<any> {
    // Vérifier si le store existe
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      throw new Error('Store not found');
    }

    // Vérifier si le store a déjà un domaine de paiement
    const existingDomain = await this.prisma.payDomain.findUnique({
      where: { storeId },
    });

    if (existingDomain) {
      throw new Error('Store already has a payment domain');
    }

    // Vérifier si le hostname est déjà utilisé
    const existingHostname = await this.prisma.payDomain.findUnique({
      where: { hostname: dto.hostname },
    });

    if (existingHostname) {
      throw new Error('Hostname already in use');
    }


    // Créer le domaine de paiement dans la base
    const payDomain = await this.prisma.payDomain.create({
      data: {
        storeId,
        hostname: dto.hostname,
        status: PayDomainStatus.PENDING,
      },
    });

    try {
      // Tenter d'ajouter le domaine à Vercel
      console.log(`[PayDomainService] Attempting to add domain ${dto.hostname} to Vercel...`);
      const vercelResult = await this.externalDomainService.addToVercel(dto.hostname);
      let vercelAlreadyExists = false;
      
      if (!vercelResult.success) {
        console.error(`[PayDomainService] Failed to add ${dto.hostname} to Vercel:`, vercelResult.error);
        if (vercelResult.error?.includes('already in use') || vercelResult.error?.includes('already exists')) {
          console.log(`Domain ${dto.hostname} already exists in Vercel, continuing...`);
          vercelAlreadyExists = true;
        } else {
          // Log l'erreur mais continue quand même la création du domaine
          console.error(`[PayDomainService] Vercel error details:`, JSON.stringify(vercelResult, null, 2));
        }
      } else {
        console.log(`[PayDomainService] Successfully added ${dto.hostname} to Vercel with ID: ${vercelResult.domainId}`);
      }

      // Tenter d'ajouter le domaine à Cloudflare
      const cloudflareResult = await this.externalDomainService.addToCloudflare(dto.hostname);
      let cloudflareAlreadyExists = false;
      
      if (!cloudflareResult.success && cloudflareResult.error?.includes('Duplicate custom hostname')) {
        console.log(`Domain ${dto.hostname} already exists in Cloudflare, checking existing hostname...`);
        cloudflareAlreadyExists = true;
        
        // Récupérer les infos du hostname existant depuis Cloudflare
        const existingHostnameInfo = await this.externalDomainService.getExistingCloudflareHostname(dto.hostname);
        if (existingHostnameInfo.success) {
          // Mettre à jour notre record avec l'ID Cloudflare existant
          await this.prisma.payDomain.update({
            where: { id: payDomain.id },
            data: {
              cloudflareHostnameId: existingHostnameInfo.customHostnameId,
              status: existingHostnameInfo.isActive ? 'ACTIVE' : 'PENDING'
            }
          });
          
          // Retourner les DNS records depuis les infos existantes
          return {
            cname: {
              host: dto.hostname,
              target: 'checkout.heypay.one',
            },
            acmeCname: {
              host: `_acme-challenge.${dto.hostname}`,
              target: '_acme-challenge.checkout.heypay.one',
            },
            ownershipVerification: existingHostnameInfo.ownershipVerification,
            sslValidation: existingHostnameInfo.sslDetails,
            message: 'Domaine récupéré depuis la configuration existante'
          };
        } else {
          throw new Error(`Le domaine ${dto.hostname} existe sur Cloudflare mais impossible de récupérer ses informations.`);
        }
      } else if (!cloudflareResult.success) {
        throw new Error(`Erreur de configuration Cloudflare: ${cloudflareResult.error}`);
      }
      
      // Nouveau domaine créé avec succès
      console.log(`Successfully added ${dto.hostname} to Cloudflare (Custom Hostname ID: ${cloudflareResult.customHostnameId})`);
      
      // Mettre à jour avec l'ID Cloudflare
      await this.prisma.payDomain.update({
        where: { id: payDomain.id },
        data: {
          cloudflareHostnameId: cloudflareResult.customHostnameId,
        }
      });

        // Retourner les DNS records pour un nouveau domaine
        return {
          cname: {
            host: dto.hostname,
            target: 'checkout.heypay.one',
          },
          acmeCname: {
            host: `_acme-challenge.${dto.hostname}`,
            target: '_acme-challenge.checkout.heypay.one',
          },
          ownershipVerification: cloudflareResult.ownershipVerification ? {
            name: cloudflareResult.ownershipVerification.name,
            type: cloudflareResult.ownershipVerification.type,
            value: cloudflareResult.ownershipVerification.value,
          } : undefined,
          sslValidation: cloudflareResult.sslDetails ? {
            txt_name: cloudflareResult.sslDetails.txt_name,
            txt_value: cloudflareResult.sslDetails.txt_value,
            validation_records: cloudflareResult.sslDetails.validation_records,
          } : undefined,
        };
    } catch (error) {
      console.error(`Error adding domain ${dto.hostname} to external services:`, error.message);
      // Nettoyer en cas d'échec
      await this.prisma.payDomain.delete({
        where: { id: payDomain.id }
      });
      throw error;
    }
  }

  async verifyAndActivateDomain(domainId: string): Promise<PayDomainResponse> {
    console.log(`🔍 Starting domain verification for domainId: ${domainId}`);
    
    const domain = await this.prisma.payDomain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      console.error(`❌ Domain not found for id: ${domainId}`);
      throw new Error('Domain not found');
    }

    console.log(`📋 Verifying domain: ${domain.hostname}`);

    try {
      // Vérifier que les CNAME sont bien configurés
      console.log(`🔍 Checking CNAME records for: ${domain.hostname}`);
      const cnameCheck = await this.verifyCnameRecords(domain.hostname);
      
      if (!cnameCheck.success) {
        console.error(`❌ CNAME verification failed: ${cnameCheck.error}`);
        throw new Error(`CNAME verification failed: ${cnameCheck.error}`);
      }

      console.log(`✅ CNAME verification successful for: ${domain.hostname}`);

      // Si tout est OK, marquer comme ACTIVE
      const updatedDomain = await this.prisma.payDomain.update({
        where: { id: domainId },
        data: {
          status: PayDomainStatus.ACTIVE,
          lastError: null,
        },
      });

      console.log(`✅ Domain ${domain.hostname} marked as ACTIVE`);
      return this.mapToResponse(updatedDomain);
    } catch (error) {
      console.error(`❌ Domain verification failed for ${domain.hostname}:`, error.message);
      
      // En cas d'échec, marquer comme FAILED
      const updatedDomain = await this.prisma.payDomain.update({
        where: { id: domainId },
        data: {
          status: PayDomainStatus.FAILED,
          lastError: error.message,
        },
      });

      console.log(`❌ Domain ${domain.hostname} marked as FAILED with error: ${error.message}`);
      return this.mapToResponse(updatedDomain);
    }
  }

  private async verifyCnameRecords(hostname: string): Promise<{ success: boolean; error?: string }> {
    try {
      const dns = require('dns').promises;
      
      console.log(`🔍 Checking main CNAME for: ${hostname}`);
      
      // Vérifier le CNAME principal
      const cnameRecords = await dns.resolveCname(hostname);
      console.log(`📋 Main CNAME records for ${hostname}:`, cnameRecords);
      
      if (!cnameRecords.some((record: string) => record.includes('checkout.heypay.one'))) {
        console.error(`❌ Main CNAME verification failed for ${hostname}. Records:`, cnameRecords);
        return { success: false, error: `CNAME record for ${hostname} does not point to checkout.heypay.one` };
      }

      console.log(`✅ Main CNAME verification successful for ${hostname}`);

      // Vérifier le CNAME ACME challenge
      const acmeHostname = `_acme-challenge.${hostname}`;
      console.log(`🔍 Checking ACME CNAME for: ${acmeHostname}`);
      
      const acmeRecords = await dns.resolveCname(acmeHostname);
      console.log(`📋 ACME CNAME records for ${acmeHostname}:`, acmeRecords);
      
      if (!acmeRecords.some((record: string) => record.includes('_acme-challenge.checkout.heypay.one'))) {
        console.error(`❌ ACME CNAME verification failed for ${acmeHostname}. Records:`, acmeRecords);
        return { success: false, error: `ACME CNAME record for ${acmeHostname} does not point to _acme-challenge.checkout.heypay.one` };
      }

      console.log(`✅ ACME CNAME verification successful for ${acmeHostname}`);
      console.log(`✅ All CNAME verifications successful for ${hostname}`);
      
      return { success: true };
    } catch (error) {
      console.error(`❌ DNS resolution failed for ${hostname}:`, error.message);
      return { success: false, error: `DNS resolution failed: ${error.message}` };
    }
  }



  async deleteDomain(domainId: string): Promise<void> {
    const domain = await this.prisma.payDomain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      throw new Error('Domain not found');
    }

    console.log(`🗑️ Deleting PayDomain ${domain.hostname} (id: ${domainId})`);

    // Supprimer de Vercel
    const vercelResult = await this.externalDomainService.removeFromVercel(domain.hostname);
    if (!vercelResult.success) {
      console.warn(`[PayDomainService] Failed to remove ${domain.hostname} from Vercel:`, vercelResult.error);
    }

    // Supprimer de Cloudflare
    if (domain.cloudflareHostnameId) {
      const cfResult = await this.externalDomainService.removeFromCloudflare(domain.cloudflareHostnameId);
      if (!cfResult.success) {
        console.warn(`[PayDomainService] Failed to remove ${domain.hostname} from Cloudflare:`, cfResult.error);
      }
    }

    // Supprimer de la DB
    await this.prisma.payDomain.delete({
      where: { id: domainId },
    });

    console.log(`✅ PayDomain ${domain.hostname} deleted successfully`);
  }

  async getDomainsByStore(storeId: string): Promise<PayDomainResponse[]> {
    const domains = await this.prisma.payDomain.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });

    return domains.map(domain => this.mapToResponse(domain));
  }

  async getDomainById(domainId: string): Promise<PayDomainResponse> {
    const domain = await this.prisma.payDomain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      throw new Error('Domain not found');
    }

    return this.mapToResponse(domain);
  }

  async getDomainDnsRecords(domainId: string): Promise<any> {
    const domain = await this.prisma.payDomain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      throw new Error('Domain not found');
    }

    // Récupérer les infos depuis Cloudflare si on a l'ID
    let cloudflareInfo = null;
    if (domain.cloudflareHostnameId) {
      const result = await this.externalDomainService.getCloudflareHostnameStatus(domain.cloudflareHostnameId);
      if (result.success) {
        cloudflareInfo = result;
      }
    }

    // Récupérer les infos depuis Vercel
    let vercelInfo = null;
    let vercelConfig = null;
    try {
      const vercelDomainResult = await this.externalDomainService.getVercelDomainInfo(domain.hostname);
      if (vercelDomainResult.success && vercelDomainResult.domain) {
        vercelInfo = vercelDomainResult.domain;
      }
      
      const vercelConfigResult = await this.externalDomainService.getVercelDomainConfig(domain.hostname);
      if (vercelConfigResult.success && vercelConfigResult.config) {
        vercelConfig = vercelConfigResult.config;
      }
    } catch (error) {
      console.warn(`Failed to get Vercel info for ${domain.hostname}:`, error.message);
    }

    // Retourner les DNS records nécessaires avec toutes les infos de validation
    const dnsRecords: any = {
      // CNAME principal pour pointer vers HeyPay
      cname: {
        type: 'CNAME',
        host: domain.hostname,
        target: 'checkout.heypay.one',
        description: 'Point your domain to HeyPay checkout'
      },
    };

    // Si on a les infos Cloudflare, ajouter les records de validation
    if (cloudflareInfo) {
      // Ownership verification TXT record
      if (cloudflareInfo.ownershipVerification) {
        dnsRecords.ownershipVerification = {
          type: cloudflareInfo.ownershipVerification.type,
          host: cloudflareInfo.ownershipVerification.name,
          value: cloudflareInfo.ownershipVerification.value,
          description: 'Cloudflare ownership verification'
        };
      }

      // SSL validation TXT record
      if (cloudflareInfo.sslDetails?.txt_name && cloudflareInfo.sslDetails?.txt_value) {
        dnsRecords.sslValidation = {
          type: 'TXT',
          host: cloudflareInfo.sslDetails.txt_name,
          value: cloudflareInfo.sslDetails.txt_value,
          description: 'SSL certificate validation'
        };
      }

      // Alternative: DCV delegation via CNAME (optionnel)
      if (cloudflareInfo.sslDetails?.dcv_delegation_records?.[0]) {
        const dcv = cloudflareInfo.sslDetails.dcv_delegation_records[0];
        dnsRecords.dcvDelegation = {
          type: 'CNAME',
          host: dcv.cname,
          target: dcv.cname_target,
          description: 'Alternative: SSL validation via CNAME delegation (optional if using TXT)'
        };
      }

      // Statut et erreurs
      dnsRecords.status = {
        hostname: cloudflareInfo.status,
        ssl: cloudflareInfo.sslStatus,
        verificationErrors: cloudflareInfo.verificationErrors
      };
    }

    // Ajouter les infos Vercel si disponibles
    if (vercelInfo || vercelConfig) {
      dnsRecords.vercel = {
        info: vercelInfo ? {
          verified: vercelInfo.verified,
          createdAt: vercelInfo.createdAt,
          updatedAt: vercelInfo.updatedAt,
        } : null,
        config: vercelConfig ? {
          configuredBy: vercelConfig.configuredBy,
          misconfigured: vercelConfig.misconfigured,
          nameservers: vercelConfig.nameservers,
          serviceType: vercelConfig.serviceType,
          recommendedCNAME: vercelConfig.recommendedCNAME?.[0]?.value || null,
          recommendedIPv4: vercelConfig.recommendedIPv4?.[0]?.value || null,
          currentCNAME: vercelConfig.cnames?.[0] || null,
          currentA: vercelConfig.aValues || null,
        } : null,
      };
    }

    return dnsRecords;
  }

  async isDomainAllowed(hostname: string): Promise<boolean> {
    const domain = await this.prisma.payDomain.findUnique({
      where: { hostname },
    });

    if (!domain) {
      return false;
    }

    // Autoriser si le domaine est PENDING ou ACTIVE
    return domain.status === PayDomainStatus.PENDING || domain.status === PayDomainStatus.ACTIVE;
  }

  private mapToResponse(domain: any): PayDomainResponse {
    return {
      id: domain.id,
      hostname: domain.hostname,
      status: domain.status,
      lastError: domain.lastError,
      cloudflareHostnameId: domain.cloudflareHostnameId,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
    };
  }
}

