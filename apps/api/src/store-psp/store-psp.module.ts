import { Module } from '@nestjs/common';
import { StorePspService } from './store-psp.service';
import { StorePspController } from './store-psp.controller';

@Module({
  controllers: [StorePspController],
  providers: [StorePspService],
  exports: [StorePspService],
})
export class StorePspModule {}
