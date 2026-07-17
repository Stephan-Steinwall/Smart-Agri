import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
    constructor(private readonly aiService: AiService) { }

    @Post('chat')
    async chat(@Body() body: { query: string; deviceId: string; sessionId: string }) {
        return this.aiService.askAgronomist(body.query, body.deviceId, body.sessionId);
    }

    @Get('insight/:deviceId')
    async getInsight(@Param('deviceId') deviceId: string) {
        return this.aiService.generateFieldInsight(deviceId);
    }
}