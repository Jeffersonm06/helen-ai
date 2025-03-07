import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { MailModule } from 'src/mail/mail.module';
import { PdfModule } from 'src/pdf/pdf.module';


@Module({
  imports:[
    HttpModule,
    ConfigModule,
    MailModule,
    PdfModule
  ],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
