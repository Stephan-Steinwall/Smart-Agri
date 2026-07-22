import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  async chat(
    @Body() body: { query: string; deviceId: string; sessionId: string },
  ) {
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
  async evaluateCrop(@Body() body: { deviceId: string; cropName: string }) {
    return this.aiService.evaluateCrop(body.deviceId, body.cropName);
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
    // Default to a farm location if lat/lon not provided
    const latitude = lat ? parseFloat(lat) : 19.0760;
    const longitude = lon ? parseFloat(lon) : 72.8777;
    return this.aiService.predictRain(deviceId, latitude, longitude);
  }

  @Post('rain-prediction/:deviceId/toggle')
  async toggleRainPrediction(
    @Param('deviceId') deviceId: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.aiService.toggleRainPrediction(deviceId, body.enabled);
  }
}
