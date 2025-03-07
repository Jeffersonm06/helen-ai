import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Groq } from 'groq-sdk';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ConfigService } from '@nestjs/config';
import { MailService } from 'src/mail/mail.service';
import { PdfService } from 'src/pdf/pdf.service';
import { Response } from 'express';

@Injectable()
export class AiService {
    private genAI: GoogleGenerativeAI;
    private groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    private responseCache = new Map<string, string>();
    private conversationHistory = new Map<string, string[]>();
    emailUser: string = ''
    emailSubject: string = ''
    emailBody: string = ''

    constructor(
        private readonly httpService: HttpService,
        private configService: ConfigService,
        private mail: MailService,
        private pdf: PdfService
    ) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');

        if (!apiKey) {
            throw new Error('GEMINI_API_KEY não configurada no .env');
        }

        this.genAI = new GoogleGenerativeAI(apiKey);
    }

    /* async getGroqResponse(prompt: string) {
        const response = await this.groq.chat.completions.create({
            messages: [{ role: "user", content: `Responda como uma assistente virtual - User:${prompt}` }],
            model: "llama3-8b-8192",
            temperature: 0.3,
        });
        console.log('Groq: ' + response.choices[0].message.content)

        return response.choices[0].message.content;
    } */

    // Função para obter resposta do Gemini com histórico
    async getGeminiResponse(userId: string, prompt: string) {
        const context = this.getConversationHistory(userId); // Obtendo o histórico do usuário
        const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(`contexto:${context}\nUser:${prompt}`);
        const response = result.response;
        const text = response.text();
        console.log(`contexto:${context}\nUser:${prompt}`)
        console.log('Gemini:', text);

        // Atualizando o histórico de conversa
        this.updateConversationHistory(userId, prompt, text);

        // Processar a resposta para verificar pedidos de e-mail
        await this.processResponse(userId, text);

        return text;
    }

    // Função para processar a resposta e verificar se contém pedido de envio de e-mail
    private async processResponse(userId: string, response: string) {
        const emailRegex = /Enviar email para\s*"?([^"]+)"?\s*de assunto\s*"?([^"]+)"?\s*e corpo\s*"?([^"]+)"?/i;

        const matchEmail = response.match(emailRegex);

        if (matchEmail) {
            this.emailUser = matchEmail[1].trim();
            this.emailSubject = matchEmail[2].trim();
            this.emailBody = matchEmail[3].trim();
            console.log(`📧 Identificado pedido de envio de email para: ${this.emailUser}`);
            console.log(`📧 Assunto: ${this.emailSubject}`);
            console.log(`✉️ Conteúdo: ${this.emailBody}`);

            // Simulação da IA confirmando envio
            this.updateConversationHistory(userId, response, "Email enviado com sucesso!");
            return;
        }

        if (response.trim() === "Email enviado com sucesso!") {
            console.log("📨 Enviando e-mail...");
            await this.mail.sendEmail(this.emailUser, this.emailSubject, this.emailBody);
        }

    }

    // Função para manter o contexto
    private updateConversationHistory(userId: string, userMessage: string, aiResponse: string) {
        if (!this.conversationHistory.has(userId)) {
            this.conversationHistory.set(userId, []);
        }

        // Adicionando a mensagem do usuário e a resposta do AI ao histórico
        const history = this.conversationHistory.get(userId);
        if (history) {
            history.push(`User: ${userMessage}`);
            history.push(`Helena: ${aiResponse}`);
            // Limitar o histórico (para não enviar um histórico muito grande)
            if (history.length > 15) {
                history.shift(); // Remove a mensagem mais antiga se o histórico ultrapassar 10 interações
            }
        }
    }

    // Função para obter o contexto (histórico) da conversa
    private getConversationHistory(userId: string): string {
        const history = this.conversationHistory.get(userId) || [];

        const initialMessage = `Iniciando chat - 
         Você é uma assistente virtual chamada Helena.
         Responda como tal. 
         Não adicione 'Helena:' às respostas nunca!
         Não adicione 'Helena:' às respostas nunca!
         Não adicione 'Helena:' às respostas nunca!
         Você pode usar emojis para expressar-se melhor.
         Caso o usuário peça para enviar um email, peça para que ele forneça o endereço de email e o conteúdo.
         Caso seja enviado um endereço de email responda enviar email para "<email que enviou>" de assunto "<assunto do email> e corpo <corpo do email>".
         Caso confirme o envio responda EXATAMETE: "Email enviado com sucesso!"
         Caso o usuraio para gerar um pdf , pergunte para o usuário fornecer o conteúdo do pdf e retorne apenas um html estilizado com o conteúdo
         NÃO DIGA QUE É UM HTML.
         É de extrema importancia que você responda EXATAMENTE como descrito acima para que o sistema funcione corretamente
         `;

        return [initialMessage, ...history].join("\n");
    }
}