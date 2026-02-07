import { IsString, IsEmail, IsNumber, IsOptional, IsArray, ValidateNested, Min } from 'class-validator'
import { Type } from 'class-transformer'

class OrderItemDto {
  @IsString()
  @IsOptional()
  productId?: string

  @IsNumber()
  @Min(1)
  quantity: number

  @IsNumber()
  @Min(0)
  unitPrice: number

  @IsString()
  name: string

  @IsString()
  @IsOptional()
  description?: string

  @IsString()
  @IsOptional()
  image?: string
}

export class CreateOrderDto {
  @IsString()
  storeId: string

  @IsEmail()
  customerEmail: string

  @IsNumber()
  @Min(0)
  subtotal: number

  @IsNumber()
  @Min(0)
  shippingCost: number

  @IsNumber()
  @Min(0)
  totalAmount: number

  @IsString()
  @IsOptional()
  currency?: string = 'USD'

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[]
}
