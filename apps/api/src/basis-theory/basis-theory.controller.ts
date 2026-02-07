import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { IsString, IsNumber, IsOptional, IsBoolean, IsObject } from 'class-validator';
import { BasisTheoryService } from './basis-theory.service';

class ChargeCardDto {
  @IsString()
  tokenIntentId: string;

  @IsNumber()
  amount: number;

  @IsString()
  currency: string;

  @IsString()
  stripeSecretKey: string;

  @IsString()
  stripeConnectedAccountId: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  saveCard?: boolean;
}

class ChargeSavedCardDto {
  @IsString()
  tokenId: string;

  @IsNumber()
  amount: number;

  @IsString()
  currency: string;

  @IsString()
  stripeSecretKey: string;

  @IsString()
  stripeConnectedAccountId: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  networkTransactionId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}

class SaveCardDto {
  @IsString()
  tokenIntentId: string;
}

@Controller('bt')
export class BasisTheoryController {
  constructor(private readonly basisTheoryService: BasisTheoryService) {}

  @Post('charge')
  async chargeCard(@Body() dto: ChargeCardDto) {
    const result = await this.basisTheoryService.chargeCard({
      tokenIntentId: dto.tokenIntentId,
      amount: dto.amount,
      currency: dto.currency,
      stripeSecretKey: dto.stripeSecretKey,
      stripeConnectedAccountId: dto.stripeConnectedAccountId,
      customerId: dto.customerId,
      description: dto.description,
      metadata: dto.metadata,
    });

    if (!result.success && result.status !== 'requires_action') {
      throw new HttpException(
        { success: false, error: result.error, stripeErrorCode: result.stripeErrorCode },
        HttpStatus.BAD_REQUEST
      );
    }

    let savedCard = null;
    if (dto.saveCard && result.status === 'succeeded') {
      const saveResult = await this.basisTheoryService.saveCard({
        tokenIntentId: dto.tokenIntentId,
      });
      if (saveResult.success) {
        savedCard = {
          tokenId: saveResult.tokenId,
          card: saveResult.card,
        };
      }
    }

    return {
      success: true,
      paymentIntentId: result.paymentIntentId,
      clientSecret: result.clientSecret,
      status: result.status,
      networkTransactionId: result.networkTransactionId,
      savedCard,
    };
  }

  @Post('charge-saved')
  async chargeSavedCard(@Body() dto: ChargeSavedCardDto) {
    const result = await this.basisTheoryService.chargeSavedCard({
      tokenId: dto.tokenId,
      amount: dto.amount,
      currency: dto.currency,
      stripeSecretKey: dto.stripeSecretKey,
      stripeConnectedAccountId: dto.stripeConnectedAccountId,
      customerId: dto.customerId,
      networkTransactionId: dto.networkTransactionId,
      description: dto.description,
      metadata: dto.metadata,
    });

    if (!result.success) {
      throw new HttpException(
        { success: false, error: result.error, stripeErrorCode: result.stripeErrorCode },
        HttpStatus.BAD_REQUEST
      );
    }

    return {
      success: true,
      paymentIntentId: result.paymentIntentId,
      clientSecret: result.clientSecret,
      status: result.status,
      networkTransactionId: result.networkTransactionId,
    };
  }

  @Post('save-card')
  async saveCard(@Body() dto: SaveCardDto) {
    const result = await this.basisTheoryService.saveCard({
      tokenIntentId: dto.tokenIntentId,
    });

    if (!result.success) {
      throw new HttpException(
        { success: false, error: result.error },
        HttpStatus.BAD_REQUEST
      );
    }

    return {
      success: true,
      tokenId: result.tokenId,
      card: result.card,
    };
  }
}
