import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiModule } from './ai/ai.module';
import { ConfigModule } from '@nestjs/config';
import { MailModule } from './mail/mail.module';
import { PdfService } from './pdf/pdf.service';
import { PdfModule } from './pdf/pdf.module';

@Module({
  imports: [
    AiModule,
    ConfigModule.forRoot({
      envFilePath: '.env.development.local',
    }),
    MailModule,
    PdfModule,
  ],
  controllers: [AppController],
  providers: [AppService, PdfService],
})
export class AppModule {}
