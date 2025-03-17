import {
  Body, Controller, Get, HttpException, HttpStatus, Post, Query, Res,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { Response } from 'express';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) { }

  @Get('chat')
  async getResponse(@Query('message') message: string) {
    try {
      const response = await this.aiService.getGeminiResponse('1', message, 'helena');

      return {
        success: true,
        response: response
      };

    } catch (error) {
      return {
        success: false,
        error: 'Erro ao processar a mensagem',
      };
    }
  }

  /* @Get('chat/groq')
  async getGroqResponse(@Query('message') message: string) {
    try {
      const response = await this.aiService.getGroqResponse(message);

      return {
        success: true,
        response: response
      };

    } catch (error) {
      return {
        success: false,
        error: 'Erro ao processar a mensagem',
      };
    }
  } */


}
