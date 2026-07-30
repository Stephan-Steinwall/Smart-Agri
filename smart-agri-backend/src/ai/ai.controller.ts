import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { AuthGuard } from '../auth/auth.guard';
import { ChatDto } from './dto/chat.dto';
import { EvaluateCropDto } from './dto/evaluate-crop.dto';
import { ToggleRainPredictionDto } from './dto/toggle-rain-prediction.dto';

@UseGuards(AuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  async chat(@Body() body: ChatDto) {
    return this.aiService.askAgronomist(
      body.query,
      body.deviceId,
      body.sessionId,
    );
  }

  @Get('insight/:deviceId')
  async getInsight(@Param('deviceId') deviceId: string) {
    return this.aiService.generateFieldInsight(deviceId);
  }

  @Get('suggest-crop/:deviceId')
  async suggestCrop(@Param('deviceId') deviceId: string) {
    return this.aiService.suggestCrop(deviceId);
  }

  @Post('evaluate-crop')
  async evaluateCrop(@Body() body: EvaluateCropDto) {
    return this.aiService.evaluateCrop(
      body.deviceId,
      body.cropName,
      body.soilMetrics,
    );
  }

  @Get('sessions')
  async getSessions() {
    return this.aiService.getChatSessions();
  }

  @Get('history/:sessionId')
  async getHistory(@Param('sessionId') sessionId: string) {
    return this.aiService.getChatHistory(sessionId);
  }

  @Get('rain-prediction/:deviceId')
  async getRainPrediction(
    @Param('deviceId') deviceId: string,
    @Query('lat') lat?: string,
    @Query('lon') lon?: string,
  ) {
    return this.aiService.predictRain(
      deviceId,
      lat ? parseFloat(lat) : undefined,
      lon ? parseFloat(lon) : undefined,
    );
  }

  @Post('rain-prediction/:deviceId/toggle')
  async toggleRainPrediction(
    @Param('deviceId') deviceId: string,
    @Body() body: ToggleRainPredictionDto,
  ) {
    return this.aiService.toggleRainPrediction(deviceId, body.enabled);
  }

  @Get('rain-prediction-status/:deviceId')
  async getRainPredictionStatus(@Param('deviceId') deviceId: string) {
    return this.aiService.getRainPredictionStatus(deviceId);
  }
}
