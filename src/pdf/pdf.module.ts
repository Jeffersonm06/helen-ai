import { Module } from '@nestjs/common';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';

@Module({
  providers: [PdfService],
  controllers: [PdfController],
  exports: [PdfService]
})
export class PdfModule { }
