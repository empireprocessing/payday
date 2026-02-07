import { Controller, Post, Get, Param, Body, HttpException, HttpStatus } from '@nestjs/common';
import { PayDomainService, CreatePayDomainDto } from './pay-domain.service';

@Controller('stores/:storeId/domains')
export class PayDomainController {
  constructor(private payDomainService: PayDomainService) {}

  @Get(':domainId/dns-records')
  async getDomainDnsRecords(
    @Param('storeId') storeId: string,
    @Param('domainId') domainId: string,
  ) {
    try {
      return await this.payDomainService.getDomainDnsRecords(domainId);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':domainId/verify')
  async verifyAndActivateDomain(
    @Param('storeId') storeId: string,
    @Param('domainId') domainId: string,
  ) {
    console.log(`🚀 API call: verifyAndActivateDomain - storeId: ${storeId}, domainId: ${domainId}`);
    
    try {
      const result = await this.payDomainService.verifyAndActivateDomain(domainId);
      console.log(`✅ API call successful: verifyAndActivateDomain - domainId: ${domainId}`);
      return result;
    } catch (error) {
      console.error(`❌ API call failed: verifyAndActivateDomain - domainId: ${domainId}, error:`, error.message);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post()
  async createPayDomain(
    @Param('storeId') storeId: string,
    @Body() dto: CreatePayDomainDto,
  ) {
    try {
      return await this.payDomainService.createPayDomain(storeId, dto);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get()
  async getDomainsByStore(@Param('storeId') storeId: string) {
    try {
      const domains = await this.payDomainService.getDomainsByStore(storeId);
      return domains.map(domain => ({
        ...domain,
        isPrimary: true, // Pour l'instant, un seul domaine par store
      }));
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
}