import { IsNumber, IsString, IsEmail, IsOptional, Min } from 'class-validator'

export class CreatePaymentIntentDto {
  @IsNumber()
  @Min(0.01)
  amount: number

  @IsString()
  @IsOptional()
  currency?: string = 'usd'

  @IsEmail()
  customerEmail: string

  @IsString()
  @IsOptional()
  storeId?: string
}
