import { Controller, Post, Body, Get } from '@nestjs/common';
import { MailService, Email } from './mail.service';

@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) { }

  @Post('send')
  async sendMail(@Body() body: { to: string; subject: string; text: string; html?: string }) {
    return this.mailService.sendEmail(body.to, body.subject, body.text, body.html);
  }

  @Get('fetch')
  async fetchEmails() {
    const emails = await this.mailService.fetchEmails();

    // Verifica se emails é um array antes de usar map
    if (Array.isArray(emails)) {
      const extractedEmails = emails.map(email => {
        const isHtml = email.html !== null;
        const coreMessage = this.mailService.extractCoreMessage(email.body, isHtml);
        return {
          from: email.from,
          subject: email.subject,
          body: email.body, 
          coreMessage
        };
      });
      return extractedEmails;
    } else {
      // Se não for um array, retorna o erro
      return { error: 'Failed to fetch emails', details: emails };
    }
  }
}
