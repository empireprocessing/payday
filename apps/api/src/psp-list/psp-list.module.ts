import { Module } from '@nestjs/common';
import { PspListService } from './psp-list.service';
import { PspListController } from './psp-list.controller';

@Module({
  controllers: [PspListController],
  providers: [PspListService],
  exports: [PspListService],
})
export class PspListModule {}
