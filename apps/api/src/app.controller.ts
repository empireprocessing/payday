import { Controller, Get, Redirect } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  @Redirect('https://heypay.one', 301)
  getHello() {
    // Redirection vers https://heypay.one
  }
}
