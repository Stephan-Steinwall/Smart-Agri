import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutomationService } from './automation.service';
import { AutomationController } from './automation.controller';
import { AutomationDevice } from './entities/automation-device.entity';
import { PumpLog } from './entities/pump-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AutomationDevice, PumpLog])],
  controllers: [AutomationController],
  providers: [AutomationService],
})
export class AutomationModule { }