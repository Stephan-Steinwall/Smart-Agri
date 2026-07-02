import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
    constructor(private readonly aiService: AiService) { }

    @Post('chat')
    async chat(@Body() body: { query: string; deviceId: string }) {
        return this.aiService.askAgronomist(body.query, body.deviceId);
    }

    @Get('insight/:fieldId')
    async getInsight(@Param('fieldId') fieldId: string) {
        return this.aiService.generateFieldInsight(fieldId);
    }
}