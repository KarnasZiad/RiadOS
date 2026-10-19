import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { openApiSchema } from '../../common/openapi';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import type { ReservationView } from './reservation.view';
import {
  type CreateReservationInput,
  CreateReservationSchema,
  type DateRangeQuery,
  DateRangeQuerySchema,
  type ListReservationsQuery,
  ListReservationsQuerySchema,
} from './reservations.schemas';
import {
  type AvailabilityView,
  type ReservationPage,
  ReservationsService,
} from './reservations.service';

@ApiTags('reservations')
@ApiBearerAuth()
@Controller()
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Roles(Role.OWNER, Role.RECEPTION)
  @ApiBody({ schema: openApiSchema(CreateReservationSchema) })
  @Post('reservations')
  create(
    @CurrentUser() caller: AuthUser,
    @Body(new ZodValidationPipe(CreateReservationSchema)) body: CreateReservationInput,
  ): Promise<ReservationView> {
    return this.reservations.create(caller, body);
  }

  @Roles(Role.OWNER, Role.RECEPTION)
  @Get('reservations')
  list(
    @CurrentUser() caller: AuthUser,
    @Query(new ZodValidationPipe(ListReservationsQuerySchema)) query: ListReservationsQuery,
  ): Promise<ReservationPage> {
    return this.reservations.list(caller, query);
  }

  @Roles(Role.OWNER, Role.RECEPTION)
  @HttpCode(HttpStatus.OK)
  @Post('reservations/:id/cancel')
  cancel(
    @CurrentUser() caller: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ReservationView> {
    return this.reservations.cancel(caller, id);
  }

  /** Readable by every role: housekeeping needs to know which rooms are occupied. */
  @Get('availability')
  availability(
    @CurrentUser() caller: AuthUser,
    @Query(new ZodValidationPipe(DateRangeQuerySchema)) query: DateRangeQuery,
  ): Promise<AvailabilityView> {
    return this.reservations.availability(caller, query);
  }
}
