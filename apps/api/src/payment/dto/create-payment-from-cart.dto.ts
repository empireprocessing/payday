import { IsString, IsNotEmpty } from 'class-validator'

export class CreatePaymentFromCartDto {
  @IsString()
  @IsNotEmpty()
  cartId: string
}
