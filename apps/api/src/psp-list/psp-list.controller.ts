import { Controller, Get, Post, Put, Delete, Body, Param, ValidationPipe, BadRequestException } from '@nestjs/common';
import { PspListService } from './psp-list.service';

@Controller('psp-list')
export class PspListController {
  constructor(private readonly pspListService: PspListService) {}

  /**
   * Récupérer toutes les listes de PSP
   */
  @Get()
  async getAllLists() {
    return this.pspListService.getAllLists();
  }

  /**
   * Récupérer une liste par ID
   */
  @Get(':id')
  async getListById(@Param('id') id: string) {
    return this.pspListService.getListById(id);
  }

  /**
   * Créer une nouvelle liste de PSP
   */
  @Post()
  async createList(@Body(ValidationPipe) data: {
    name: string;
    pspIds?: string[];
  }) {
    return this.pspListService.createList(data);
  }

  /**
   * Mettre à jour une liste de PSP
   */
  @Put(':id')
  async updateList(
    @Param('id') id: string,
    @Body(ValidationPipe) data: {
      name?: string;
      pspIds?: string[];
    }
  ) {
    return this.pspListService.updateList(id, data);
  }

  /**
   * Supprimer une liste de PSP
   */
  @Delete(':id')
  async deleteList(@Param('id') id: string) {
    return this.pspListService.deleteList(id);
  }

  /**
   * Ajouter des PSP à une liste
   */
  @Post(':id/psps')
  async addPspsToList(
    @Param('id') id: string,
    @Body(ValidationPipe) data: {
      pspIds: string[];
    }
  ) {
    if (!data.pspIds || !Array.isArray(data.pspIds) || data.pspIds.length === 0) {
      throw new BadRequestException('pspIds doit être un tableau non vide');
    }
    return this.pspListService.addPspsToList(id, data.pspIds);
  }

  /**
   * Retirer un PSP d'une liste
   */
  @Delete(':id/psps/:pspId')
  async removePspFromList(
    @Param('id') id: string,
    @Param('pspId') pspId: string
  ) {
    return this.pspListService.removePspFromList(id, pspId);
  }
}
