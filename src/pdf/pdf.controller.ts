import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { Response } from 'express';

@Controller('pdf')
export class PdfController {
  constructor(private readonly pdfService: PdfService) { }
  @Post('generate')
  async generatePdf(@Res() res: Response, @Body() body: { htmlContent: string }) {
    await this.pdfService.generatePdf(body.htmlContent, res);
  }
}
