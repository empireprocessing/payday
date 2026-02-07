import { Test, TestingModule } from '@nestjs/testing';
import { WoocommerceController } from './woocommerce.controller';

describe('WoocommerceController', () => {
  let controller: WoocommerceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WoocommerceController],
    }).compile();

    controller = module.get<WoocommerceController>(WoocommerceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
