import { IsString, IsNotEmpty, IsOptional } from 'class-validator'

export class RetryPaymentDto {
  @IsString()
  @IsNotEmpty()
  previousPaymentIntentId: string

  @IsString()
  @IsNotEmpty()
  checkoutId: string

  @IsString()
  @IsOptional()
  lastErrorCode?: string

  @IsString()
  @IsOptional()
  storeId?: string

  @IsString()
  @IsOptional()
  currency?: string
}


