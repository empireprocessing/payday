import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { DnsService } from './dns.service';

@Controller('dns')
export class DnsController {
  constructor(private dnsService: DnsService) {}

  @Post('verify')
  async verifyDns(@Body() body: { hostname: string }) {
    console.log(`🚀 DNS verification request for: ${body.hostname}`);
    
    try {
      const result = await this.dnsService.verifyCnameRecords(body.hostname);
      console.log(`✅ DNS verification completed for ${body.hostname}:`, result);
      return result;
    } catch (error) {
      console.error(`❌ DNS verification failed for ${body.hostname}:`, error.message);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
}
