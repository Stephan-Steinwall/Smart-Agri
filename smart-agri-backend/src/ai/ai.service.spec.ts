import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('mock-key') } },
        { provide: TelemetryService, useValue: {} },
        { provide: SupabaseService, useValue: {} },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
