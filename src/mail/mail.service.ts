import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as imaps from 'imap-simple';
import { ImapSimple, ImapSimpleOptions } from 'imap-simple';
import * as dotenv from 'dotenv';
import { simpleParser } from 'mailparser';
import * as cheerio from 'cheerio';

export interface Email {
    from: string;
    subject: string;
    body: string;
    html: string | null;
}

dotenv.config();

@Injectable()
export class MailService {
    private transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER || "",
            pass: process.env.EMAIL_PASS || "",
        },
    });

    private imapConfig: ImapSimpleOptions = {
        imap: {
            user: process.env.EMAIL_USER || "",
            password: process.env.EMAIL_PASS || "",
            host: 'imap.gmail.com',
            port: 993,
            tls: true,
            authTimeout: 3000,
            tlsOptions: { rejectUnauthorized: false }
        }
    };

    async sendEmail(to: string, subject: string, text: string, html?: string) {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to,
            subject,
            text,
            html,
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            return { success: true, info };
        } catch (error) {
            return { success: false, error };
        }
    }

    async fetchEmails() {
        const searchCriteria = ['UNSEEN'];
        const fetchOptions = { bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'], struct: true };

        try {
            const connection = await imaps.connect(this.imapConfig);
            await connection.openBox('INBOX');

            const messages = await connection.search(searchCriteria, fetchOptions);
            const emails: Email[] = [];

            for (const item of messages) {
                const all = item.parts.find(part => part.which === 'TEXT');
                const rawEmail = all ? all.body : '';

                // **Decodifica o e-mail**
                const parsed = await simpleParser(rawEmail);
                emails.push({
                    from: parsed.from?.[0]?.name || parsed.from?.[0]?.address || 'Desconhecido',
                    subject: parsed.subject || 'Sem assunto',
                    body: parsed.text || '(Sem conteúdo)',
                    html: parsed.html || null,
                });
            }

            connection.end();
            return emails;
        } catch (error) {
            console.error('Erro ao buscar e-mails:', error);
            return { error: 'Erro ao buscar e-mails', details: error.message };
        }
    }

    extractTextFromEmailBody(html: string): string {
        const $ = cheerio.load(html);
        return $('body').text().trim();
    }

    extractPlainTextBody(text: string): string {
        const match = text.match(/([^.?!]+[.?!])/);
        if (match) {
            return match[0];
        }
        return text;
    }

    extractCoreMessage(body: string, isHtml: boolean): string {
        if (isHtml) {
            return this.extractTextFromEmailBody(body);
        } else {
            return this.extractPlainTextBody(body);
        }
    }
}
