import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModifiersController } from './modifiers.controller';
import { ModifiersService } from './modifiers.service';
import { ModifierGroup } from './entities/modifier-group.entity';
import { Modifier } from './entities/modifier.entity';
import { TenantAccessService } from '@common/guards/tenant-access.service';
import { Business } from '@modules/business/entities/business.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ModifierGroup, Modifier, Business])],
  controllers: [ModifiersController],
  providers: [TenantAccessService, ModifiersService],
  exports: [ModifiersService],
})
export class ModifiersModule {}
