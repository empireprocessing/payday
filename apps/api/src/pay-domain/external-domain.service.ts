import { Injectable, Logger } from '@nestjs/common';

export interface VercelDomainResult {
  success: boolean;
  domainId?: string;
  error?: string;
}

export interface VercelDomainInfo {
  name: string;
  apexName: string;
  projectId: string;
  verified: boolean;
  createdAt: number;
  updatedAt: number;
  redirect?: string | null;
  redirectStatusCode?: number | null;
}

export interface VercelDomainConfig {
  configuredBy: 'CNAME' | 'A' | 'http' | 'dns-01';
  nameservers: string[];
  serviceType: 'external' | 'vercel';
  cnames?: string[];
  aValues?: string[];
  recommendedCNAME?: Array<{ rank: number; value: string }>;
  recommendedIPv4?: Array<{ rank: number; value: string[] }>;
  misconfigured: boolean;
  ipStatus?: string;
  acceptedChallenges?: string[];
}

export interface CloudflareDomainResult {
  success: boolean;
  customHostnameId?: string;
  error?: string;
  sslStatus?: string;
  hostname?: string;
  status?: string;
  verificationErrors?: string[];
  ownershipVerification?: {
    type: string;
    name: string;
    value: string;
  };
  ownershipVerificationHttp?: {
    http_url: string;
    http_body: string;
  };
  sslDetails?: {
    id: string;
    type: string;
    method: string;
    status: string;
    txt_name?: string;
    txt_value?: string;
    validation_records?: Array<{
      status: string;
      txt_name: string;
      txt_value: string;
    }>;
    dcv_delegation_records?: Array<{
      cname: string;
      cname_target: string;
    }>;
    bundle_method?: string;
    wildcard: boolean;
    certificate_authority: string;
  };
  createdAt?: string;
}

@Injectable()
export class ExternalDomainService {
  private readonly logger = new Logger(ExternalDomainService.name);

  async addToVercel(hostname: string, projectId?: string): Promise<VercelDomainResult> {
    try {
      // Utiliser les credentials fournis ou les variables d'environnement
      const vercelToken = process.env.VERCEL_API_TOKEN;
      const vercelProjectId = projectId || process.env.VERCEL_PROJECT_ID;

      if (!vercelToken || !vercelProjectId) {
        this.logger.warn('Vercel not configured (VERCEL_API_TOKEN or VERCEL_PROJECT_ID missing), skipping...');
        return { success: true, domainId: 'skipped' };
      }

      this.logger.log(`[Vercel] Adding domain ${hostname} to Vercel project ${vercelProjectId}`);
      this.logger.log(`[Vercel] Using token: ${vercelToken.substring(0, 10)}...`);

      // Essayer directement d'ajouter le domaine (certains tokens peuvent avoir accès direct sans vérification préalable)
      const response = await fetch(`https://api.vercel.com/v10/projects/${vercelProjectId}/domains`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${vercelToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: hostname,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        this.logger.error(`[Vercel] API error (status ${response.status}):`, JSON.stringify(errorData, null, 2));
        this.logger.error(`[Vercel] Request details:`, {
          url: `https://api.vercel.com/v10/projects/${vercelProjectId}/domains`,
          projectId: vercelProjectId,
          hostname: hostname,
        });
        
        // Si le projet n'est pas trouvé, essayer de diagnostiquer le problème
        if (response.status === 404 || (errorData.error?.code === 'not_found')) {
          // Vérifier les informations du compte
          try {
            const userResponse = await fetch(`https://api.vercel.com/v2/user`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${vercelToken}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (userResponse.ok) {
              const userData = await userResponse.json();
              this.logger.error(`[Vercel] User info:`, JSON.stringify(userData, null, 2));
              this.logger.error(`[Vercel] Possible issues:`);
              this.logger.error(`  - Project ID ${vercelProjectId} may be incorrect`);
              this.logger.error(`  - Token may not have permissions to access this project`);
              this.logger.error(`  - Token may need "Full Account" or "Projects" + "Domains" scopes`);
              this.logger.error(`  - Project may belong to a different team/organization`);
            }
          } catch (userError) {
            this.logger.error(`[Vercel] Could not fetch user info:`, userError.message);
          }
        }
        
        throw new Error(`Vercel API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      this.logger.log(`Successfully added domain ${hostname} to Vercel`);

      return {
        success: true,
        domainId: data.name,
      };
    } catch (error) {
      this.logger.error(`Failed to add domain ${hostname} to Vercel:`, error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async addToCloudflare(hostname: string, zoneId?: string): Promise<CloudflareDomainResult> {
    try {
      const cloudflareApiKey = process.env.CLOUDFLARE_API_KEY;
      const cloudflareZoneId = zoneId || process.env.CLOUDFLARE_ZONE_ID;

      if (!cloudflareApiKey || !cloudflareZoneId) {
        this.logger.warn('Cloudflare not configured (CLOUDFLARE_API_KEY or CLOUDFLARE_ZONE_ID missing), skipping...');
        return { success: true, customHostnameId: 'skipped' };
      }

      this.logger.log(`Adding custom hostname ${hostname} to Cloudflare zone ${cloudflareZoneId}`);

      const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${cloudflareZoneId}/custom_hostnames`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cloudflareApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hostname: hostname,
          ssl: {
            method: 'txt',
            type: 'dv'
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        this.logger.error(`Cloudflare API error:`, errorData);
        throw new Error(`Cloudflare API error: ${errorData.errors?.[0]?.message || response.statusText}`);
      }

      const data = await response.json();
      const result = data.result;
      
      this.logger.log(`Successfully added custom hostname ${hostname} to Cloudflare`);
      this.logger.log(`Custom hostname ID: ${result.id}`);
      this.logger.log(`Ownership verification TXT record: ${result.ownership_verification?.name} = ${result.ownership_verification?.value}`);

      return {
        success: true,
        customHostnameId: result.id,
        hostname: result.hostname,
        status: result.status,
        verificationErrors: result.verification_errors,
        sslStatus: result.ssl?.status,
        sslDetails: result.ssl,
        ownershipVerification: result.ownership_verification,
        ownershipVerificationHttp: result.ownership_verification_http,
        createdAt: result.created_at,
      };
    } catch (error) {
      this.logger.error(`Failed to add hostname ${hostname} to Cloudflare:`, error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async removeFromVercel(hostname: string, projectId?: string): Promise<VercelDomainResult> {
    try {
      const vercelToken = process.env.VERCEL_API_TOKEN;
      const vercelProjectId = projectId || process.env.VERCEL_PROJECT_ID;

      if (!vercelToken || !vercelProjectId) {
        this.logger.warn('Vercel not configured, skipping removal...');
        return { success: true };
      }

      this.logger.log(`Removing domain ${hostname} from Vercel project ${vercelProjectId}`);

      const response = await fetch(`https://api.vercel.com/v10/projects/${vercelProjectId}/domains/${hostname}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${vercelToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        this.logger.error(`Vercel API error:`, errorData);
        throw new Error(`Vercel API error: ${errorData.error?.message || response.statusText}`);
      }

      this.logger.log(`Successfully removed domain ${hostname} from Vercel`);

      return {
        success: true,
      };
    } catch (error) {
      this.logger.error(`Failed to remove domain ${hostname} from Vercel:`, error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Récupère les informations d'un domaine depuis Vercel
   */
  async getVercelDomainInfo(hostname: string, projectId?: string): Promise<{ success: boolean; domain?: VercelDomainInfo; error?: string }> {
    try {
      const vercelToken = process.env.VERCEL_API_TOKEN;
      const vercelProjectId = projectId || process.env.VERCEL_PROJECT_ID;

      if (!vercelToken || !vercelProjectId) {
        return { success: false, error: 'Vercel not configured' };
      }

      this.logger.log(`[Vercel] Getting domain info for ${hostname} in project ${vercelProjectId}`);

      // Récupérer les domaines du projet
      const response = await fetch(`https://api.vercel.com/v9/projects/${vercelProjectId}/domains`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${vercelToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        this.logger.error(`[Vercel] Failed to get domain info:`, errorData);
        return { success: false, error: errorData.error?.message || response.statusText };
      }

      const data = await response.json();
      const domain = data.domains?.find((d: VercelDomainInfo) => d.name === hostname);

      if (!domain) {
        return { success: false, error: 'Domain not found in project' };
      }

      return { success: true, domain };
    } catch (error) {
      this.logger.error(`[Vercel] Error getting domain info:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Récupère la configuration DNS d'un domaine depuis Vercel
   */
  async getVercelDomainConfig(hostname: string): Promise<{ success: boolean; config?: VercelDomainConfig; error?: string }> {
    try {
      const vercelToken = process.env.VERCEL_API_TOKEN;

      if (!vercelToken) {
        return { success: false, error: 'Vercel not configured' };
      }

      this.logger.log(`[Vercel] Getting domain config for ${hostname}`);

      const response = await fetch(`https://api.vercel.com/v6/domains/${hostname}/config`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${vercelToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        this.logger.error(`[Vercel] Failed to get domain config:`, errorData);
        return { success: false, error: errorData.error?.message || response.statusText };
      }

      const config = await response.json();
      return { success: true, config };
    } catch (error) {
      this.logger.error(`[Vercel] Error getting domain config:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async removeFromCloudflare(customHostnameId: string, zoneId?: string): Promise<CloudflareDomainResult> {
    try {
      const cloudflareApiKey = process.env.CLOUDFLARE_API_KEY;
      const cloudflareZoneId = zoneId || process.env.CLOUDFLARE_ZONE_ID;

      if (!cloudflareApiKey || !cloudflareZoneId) {
        this.logger.warn('Cloudflare not configured, skipping removal...');
        return { success: true };
      }

      this.logger.log(`Removing custom hostname ${customHostnameId} from Cloudflare zone ${cloudflareZoneId}`);

      const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${cloudflareZoneId}/custom_hostnames/${customHostnameId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${cloudflareApiKey}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        this.logger.error(`Cloudflare API error:`, errorData);
        throw new Error(`Cloudflare API error: ${errorData.errors?.[0]?.message || response.statusText}`);
      }

      this.logger.log(`Successfully removed custom hostname ${customHostnameId} from Cloudflare`);

      return {
        success: true,
      };
    } catch (error) {
      this.logger.error(`Failed to remove custom hostname ${customHostnameId} from Cloudflare:`, error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getCloudflareHostnameStatus(customHostnameId: string, zoneId?: string): Promise<CloudflareDomainResult> {
    try {
      const cloudflareApiKey = process.env.CLOUDFLARE_API_KEY;
      const cloudflareZoneId = zoneId || process.env.CLOUDFLARE_ZONE_ID;

      if (!cloudflareApiKey || !cloudflareZoneId) {
        this.logger.warn('Cloudflare not configured, cannot get hostname status');
        return { success: false, error: 'Cloudflare not configured' };
      }

      const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${cloudflareZoneId}/custom_hostnames/${customHostnameId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cloudflareApiKey}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Cloudflare API error: ${errorData.errors?.[0]?.message || response.statusText}`);
      }

      const data = await response.json();
      const result = data.result;

      return {
        success: true,
        customHostnameId: result.id,
        hostname: result.hostname,
        status: result.status,
        verificationErrors: result.verification_errors,
        sslStatus: result.ssl?.status,
        sslDetails: result.ssl,
        ownershipVerification: result.ownership_verification,
        ownershipVerificationHttp: result.ownership_verification_http,
        createdAt: result.created_at,
      };
    } catch (error) {
      this.logger.error(`Failed to get Cloudflare hostname status:`, error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getExistingCloudflareHostname(hostname: string, zoneId?: string): Promise<CloudflareDomainResult & { isActive?: boolean }> {
    try {
      const cloudflareApiKey = process.env.CLOUDFLARE_API_KEY;
      const cloudflareZoneId = zoneId || process.env.CLOUDFLARE_ZONE_ID;

      if (!cloudflareApiKey || !cloudflareZoneId) {
        this.logger.warn('Cloudflare not configured, cannot get existing hostname');
        return { success: false, error: 'Cloudflare not configured' };
      }

      this.logger.log(`Searching for existing hostname ${hostname} in Cloudflare zone ${cloudflareZoneId}`);

      const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${cloudflareZoneId}/custom_hostnames?hostname=${hostname}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cloudflareApiKey}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Cloudflare API error: ${errorData.errors?.[0]?.message || response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.result || data.result.length === 0) {
        return {
          success: false,
          error: `Hostname ${hostname} not found in Cloudflare`,
        };
      }

      // Prendre le premier résultat correspondant
      const result = data.result[0];
      const isActive = result.status === 'active';

      this.logger.log(`Found existing hostname ${hostname} with ID ${result.id}, status: ${result.status}`);

      return {
        success: true,
        customHostnameId: result.id,
        hostname: result.hostname,
        status: result.status,
        isActive,
        verificationErrors: result.verification_errors,
        sslStatus: result.ssl?.status,
        sslDetails: result.ssl,
        ownershipVerification: result.ownership_verification,
        ownershipVerificationHttp: result.ownership_verification_http,
        createdAt: result.created_at,
      };
    } catch (error) {
      this.logger.error(`Failed to get existing Cloudflare hostname ${hostname}:`, error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}