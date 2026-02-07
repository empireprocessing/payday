import { Module } from '@nestjs/common';
import { PayDomainController } from './pay-domain.controller';
import { PayDomainService } from './pay-domain.service';
import { ExternalDomainService } from './external-domain.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [PayDomainController],
  providers: [PayDomainService, ExternalDomainService],
  exports: [PayDomainService],
})
export class PayDomainModule {}

