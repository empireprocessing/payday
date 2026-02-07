import { Module } from '@nestjs/common';
import { BasisTheoryService } from './basis-theory.service';
import { BasisTheoryController } from './basis-theory.controller';

@Module({
  controllers: [BasisTheoryController],
  providers: [BasisTheoryService],
  exports: [BasisTheoryService],
})
export class BasisTheoryModule {}
