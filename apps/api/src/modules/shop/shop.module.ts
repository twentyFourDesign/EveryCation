import { Body, Controller, Get, Headers, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser, Public, type AuthUser } from '../../common/auth.guard.js';
import { badRequest } from '../../common/errors.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { ShopService } from './shop.service.js';

const orderBody = z.object({
  items: z.array(z.object({ productId: z.uuid(), qty: z.number().int().min(1).max(20) })).min(1, 'Your basket is empty').max(30),
  delivery: z.enum(['standard', 'express']), address: z.string().trim().min(10, 'Enter the full delivery address').max(300), phone: z.string().trim().min(7, 'Enter a phone number for the courier').max(20),
  goalId: z.uuid().optional(), pin: z.string().regex(/^\d{4}$/, 'Your PIN has 4 digits'),
});

@ApiTags('shop')
@Controller('shop')
class ShopController {
  constructor(private readonly shop: ShopService) {}
  @Public() @Get('products') products(@Query('category') category?: string, @Query('q') q?: string) { return this.shop.products({ category, search: q }); }
  @Public() @Get('products/:id') product(@Param('id', ParseUUIDPipe) id: string) { return this.shop.product(id); }
  @Public() @Get('categories') categories() { return this.shop.categories(); }
  @Public() @Get('delivery') delivery() { return this.shop.deliveryOptions(); }
  @ApiBearerAuth() @Get('orders') orders(@CurrentUser() u: AuthUser) { return this.shop.myOrders(u.id); }
  @ApiBearerAuth() @Get('orders/:id') order(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.shop.order(u.id, id); }
  @ApiBearerAuth() @Post('orders')
  place(@CurrentUser() u: AuthUser, @Body(new ZodPipe(orderBody)) b: z.infer<typeof orderBody>, @Headers('idempotency-key') key?: string) {
    if (!key || key.length < 8) throw badRequest('idempotency_key_required', 'Send an Idempotency-Key header (a fresh UUID per attempt).');
    return this.shop.placeOrder(u.id, b, key);
  }
}

@Module({ imports: [WalletModule], controllers: [ShopController], providers: [ShopService], exports: [ShopService] })
export class ShopModule {}
