import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { openApiSchema } from '../../common/openapi';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import {
  type CreateRoomInput,
  CreateRoomSchema,
  type UpdateRoomInput,
  UpdateRoomSchema,
} from './rooms.schemas';
import { RoomsService, type RoomView } from './rooms.service';

@ApiTags('rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  list(@CurrentUser() caller: AuthUser): Promise<RoomView[]> {
    return this.rooms.list(caller);
  }

  @Roles(Role.OWNER)
  @ApiBody({ schema: openApiSchema(CreateRoomSchema) })
  @Post()
  create(
    @CurrentUser() caller: AuthUser,
    @Body(new ZodValidationPipe(CreateRoomSchema)) body: CreateRoomInput,
  ): Promise<RoomView> {
    return this.rooms.create(caller, body);
  }

  @Roles(Role.OWNER)
  @ApiBody({ schema: openApiSchema(UpdateRoomSchema) })
  @Patch(':id')
  update(
    @CurrentUser() caller: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateRoomSchema)) body: UpdateRoomInput,
  ): Promise<RoomView> {
    return this.rooms.update(caller, id, body);
  }
}
