import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../../common/auth.guard.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { TripsService } from './trips.service.js';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD').refine((d) => !Number.isNaN(Date.parse(d)), 'That date does not exist');
const tripBody = z.object({ title: z.string().trim().min(2, 'Give the trip a name').max(80), place: z.string().trim().min(2, 'Add where you are going').max(80), countryCode: z.string().length(2, 'Choose a country'),
  startDate: day, endDate: day, travellers: z.number().int().min(1).max(50).optional(), imageKey: z.string().max(40).optional() });
const itemBody = z.object({ day, time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 06:30'), title: z.string().trim().min(2, 'Add a title').max(80), note: z.string().trim().max(200).optional(), remind: z.string().max(40).optional() });
const bucketBody = z.object({ title: z.string().trim().min(3, 'Say what you dream of doing').max(80), source: z.string().max(80).optional(), imageKey: z.string().max(40).optional() });
const stateBody = z.object({ state: z.enum(['dream', 'done']) });

@ApiTags('trips') @ApiBearerAuth()
@Controller()
export class TripsController {
  constructor(private readonly trips: TripsService) {}
  @Get('trips') list(@CurrentUser() u: AuthUser) { return this.trips.list(u.id); }
  @Post('trips') create(@CurrentUser() u: AuthUser, @Body(new ZodPipe(tripBody)) b: z.infer<typeof tripBody>) { return this.trips.create(u.id, b); }
  @Get('trips/:id') get(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.trips.get(u.id, id); }
  @Patch('trips/:id') update(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(tripBody.partial())) b: Partial<z.infer<typeof tripBody>>) { return this.trips.update(u.id, id, b); }
  @Post('trips/:id/items') addItem(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(itemBody)) b: z.infer<typeof itemBody>) { return this.trips.addItem(u.id, id, b); }
  @Delete('trips/:id/items/:itemId') removeItem(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('itemId', ParseUUIDPipe) itemId: string) { return this.trips.removeItem(u.id, id, itemId); }

  @Get('bucket-list') bucket(@CurrentUser() u: AuthUser) { return this.trips.bucket(u.id); }
  @Post('bucket-list') @HttpCode(200) addBucket(@CurrentUser() u: AuthUser, @Body(new ZodPipe(bucketBody)) b: z.infer<typeof bucketBody>) { return this.trips.addBucket(u.id, b); }
  @Patch('bucket-list/:id') setState(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(stateBody)) b: z.infer<typeof stateBody>) { return this.trips.setBucketState(u.id, id, b.state); }
  @Delete('bucket-list/:id') removeBucket(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.trips.removeBucket(u.id, id); }
}
