import { Controller, Post, Delete, Get, Body, Param, ValidationPipe } from '@nestjs/common';
import { StorePspService } from './store-psp.service';

@Controller('store-psp')
export class StorePspController {
  constructor(private readonly storePspService: StorePspService) {}

  /**
   * Lier un PSP à une boutique
   */
  @Post('link')
  async linkPspToStore(@Body(ValidationPipe) data: {
    storeId: string;
    pspId: string;
  }) {
    return this.storePspService.linkPspToStore(data.storeId, data.pspId);
  }

  /**
   * Délier un PSP d'une boutique
   */
  @Delete('unlink')
  async unlinkPspFromStore(@Body(ValidationPipe) data: {
    storeId: string;
    pspId: string;
  }) {
    return this.storePspService.unlinkPspFromStore(data.storeId, data.pspId);
  }

  /**
   * Récupérer les PSP d'une boutique
   */
  @Get('store/:storeId')
  async getPspsByStore(@Param('storeId') storeId: string) {
    return this.storePspService.getPspsByStore(storeId);
  }

  /**
   * Lier tous les PSP d'une liste à une boutique
   */
  @Post('link-list')
  async linkListToStore(@Body(ValidationPipe) data: {
    storeId: string;
    listId: string;
  }) {
    return this.storePspService.linkListToStore(data.storeId, data.listId);
  }
}
