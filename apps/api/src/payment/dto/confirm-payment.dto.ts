import { IsString, IsNotEmpty, IsEmail, IsOptional } from 'class-validator'

export class ConfirmPaymentDto {
  @IsString()
  @IsNotEmpty()
  paymentIntentId: string

  @IsEmail()
  @IsOptional()
  customerEmail?: string

  @IsString()
  @IsOptional()
  customerName?: string

  @IsString()
  @IsOptional()
  customerPhone?: string

  @IsOptional()
  customerAddress?: {
    line1?: string
    line2?: string
    city?: string
    postal_code?: string
    country?: string
    state?: string
  }
}
