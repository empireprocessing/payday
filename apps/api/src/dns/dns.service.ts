import { Injectable } from '@nestjs/common';

@Injectable()
export class DnsService {
  async verifyCnameRecords(hostname: string): Promise<{ success: boolean; error?: string }> {
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
}
