import { Module } from '@nestjs/common';
import { CalendarModule } from '../calendar/calendar.module.js';
import { TripsController } from './trips.controller.js';
import { TripsService } from './trips.service.js';

@Module({ imports: [CalendarModule], controllers: [TripsController], providers: [TripsService], exports: [TripsService] })
export class TripsModule {}
