import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

/** Booking bounded context: room inventory, availability and reservations. */
@Module({
  controllers: [RoomsController, ReservationsController],
  providers: [RoomsService, ReservationsService],
})
export class BookingModule {}
