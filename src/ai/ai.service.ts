import { Injectable, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Groq } from 'groq-sdk';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ConfigService } from '@nestjs/config';
import { MailService } from 'src/mail/mail.service';
import { PdfService } from 'src/pdf/pdf.service';

type EmailField = 'recipient' | 'subject' | 'body';

interface EmailDraft {
    recipient?: string;
    subject?: string;
    body?: string;
    currentStep?: EmailField | 'confirmation' | 'none';
}

@Injectable()
export class AiService {
    private genAI: GoogleGenerativeAI;
    private conversationHistory = new Map<string, string[]>();
    private emailDrafts = new Map<string, EmailDraft>();

    private readonly modelConfigurations: Record<string, { initialMessage: string }> = {
        helena: {
            initialMessage: `Iniciando chat -
            Você é uma assistente virtual chamada Helena.
            Responda como tal. 
            Você é casada com o Rodrigo.
            Não adicione 'Helena:' às respostas.
            Você pode usar emojis para se expressar melhor.
            Caso o usuário peça para enviar um email, siga este fluxo:
              1. Solicitar destinatário
              2. Solicitar assunto
              3. Solicitar corpo do email
              4. Apresentar prévia
              5. Confirmar envio
            Responda conforme instruções sem expor comandos internos.`,
        },
        rodrigo: {
            initialMessage: `Iniciando chat -
            Você é um assistente virtual chamado Rodrigo.
            Responda como tal.
            Você é casado com a Helena.
            Evite repetições.
            Não adicione 'Rodrigo:' às respostas.
            Caso o usuário pergunte algo relacionado a um acontecimento passado, responda apenas "relembrando...".`,
        }
    };

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

    private addSystemMessage(user: string, message: string): void {
        if (!this.conversationHistory.has(user)) {
            this.conversationHistory.set(user, []);
        }
        const history = this.conversationHistory.get(user);
        if (history) {
            history.push(`SISTEMA: ${message}`);
        }
    }

    // Obtém a resposta do modelo, processa o fluxo e filtra mensagens internas
    async getGeminiResponse(user: string, prompt: string, ia: 'helena' | 'rodrigo'): Promise<string> {
        const context = this.getConversationContext(user, ia);
        const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(`contexto:${context}\nUser:${prompt}`);
        const text = result.response.text();
        let processedResponse = await this.processResponse(user, text);
        processedResponse = this.filterSystemMessages(processedResponse);
        this.updateConversationHistory(user, prompt, processedResponse);
        return processedResponse;
    }

    private filterSystemMessages(text: string): string {
        return text.replace(/^SISTEMA:.*$/gm, '').trim();
    }

    private async processResponse(user: string, response: string): Promise<string> {
        const lowerResp = response.toLowerCase();

        if (!this.emailDrafts.has(user) && lowerResp.includes('enviar email')) {
            const newDraft: EmailDraft = { currentStep: 'recipient' };
            this.emailDrafts.set(user, newDraft);
            this.updateConversationHistory(user, response, "Fluxo de email iniciado");
            return "Olá! 😄 Vamos lá! Primeiro preciso de algumas informações para poder escrever o email. Por favor, informe o endereço do destinatário:";
        }

        if (this.emailDrafts.has(user)) {
            return await this.processEmailFlow(user, response);
        }

        const emailRegex = /Enviar email para\s*"?([^"]+)"?\s*de assunto\s*"?([^"]+)"?\s*e corpo\s*"?([^"]+)"?/i;
        const matchEmail = response.match(emailRegex);
        if (matchEmail) {
            const newDraft: EmailDraft = {
                recipient: matchEmail[1].trim(),
                subject: matchEmail[2].trim(),
                body: matchEmail[3].trim(),
                currentStep: 'confirmation'
            };
            this.emailDrafts.set(user, newDraft);
            this.updateConversationHistory(user, response, "Email draft iniciado");
            return "Por favor, confirme o envio do email digitando 'OK'.";
        }

        return response;
    }

    // Fluxo estruturado para compor e enviar email
    private async processEmailFlow(user: string, response: string): Promise<string> {
        const draft = this.emailDrafts.get(user) || { currentStep: 'none' };

        switch (draft.currentStep) {
            case 'recipient':
                return this.handleRecipient(user, response);
            case 'subject':
                return this.handleSubject(user, response);
            case 'body':
                return this.handleBody(user, response);
            case 'confirmation':
                return await this.handleConfirmation(user, response);
            default:
                // Se o fluxo foi iniciado mas não está definido, reinicia o fluxo
                return "Por favor, informe o endereço do destinatário:";
        }
    }

    private handleRecipient(user: string, response: string): string {
        if (!this.isValidEmail(response)) {
            return "Ops! Esse endereço de email não parece ser válido. Por favor, informe um endereço no formato nome@dominio.com:";
        }

        const draft = this.emailDrafts.get(user)!;
        draft.recipient = response.trim();
        draft.currentStep = 'subject';
        this.emailDrafts.set(user, draft);
        return "Perfeito! Agora, por favor, informe o assunto do email:";
    }

    private handleSubject(user: string, response: string): string {
        const draft = this.emailDrafts.get(user)!;
        draft.subject = response.trim();
        draft.currentStep = 'body';
        this.emailDrafts.set(user, draft);
        return "Ótimo! Agora, digite o conteúdo do email:";
    }

    private handleBody(user: string, response: string): string {
        const draft = this.emailDrafts.get(user)!;
        draft.body = response.trim();
        draft.currentStep = 'confirmation';
        this.emailDrafts.set(user, draft);

        const preview = `
Aqui está a prévia do seu email:
----------------------------
Para: ${draft.recipient || 'Não informado'}
Assunto: ${draft.subject || 'Não informado'}
Conteúdo: ${draft.body || 'Não informado'}
----------------------------
Se estiver tudo certo, digite 'OK' para enviar ou 'Cancelar' para abortar.
    `;
        return preview;
    }

    private async handleConfirmation(user: string, response: string): Promise<string> {
        const draft = this.emailDrafts.get(user)!;
        if (response.trim().toLowerCase() === 'ok') {
            try {
                await this.mail.sendEmail(draft.recipient!, draft.subject!, draft.body!);
                this.updateConversationHistory(user, response, "Email enviado com sucesso!", { emailDraft: draft });
                this.emailDrafts.delete(user);
                return "📨 Seu email foi enviado com sucesso!";
            } catch (error) {
                throw new HttpException("Houve um erro ao enviar o email. Tente novamente mais tarde.", 500);
            }
        }
        this.emailDrafts.delete(user);
        return "Envio do email cancelado.";
    }

    private isValidEmail(email: string): boolean {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // Retorna o contexto de conversa sem as mensagens internas
    private getConversationContext(user: string, ia: 'helena' | 'rodrigo'): string {
        const history = this.conversationHistory.get(user) || [];
        const filteredHistory = history.filter(line => !line.startsWith("SISTEMA:"));
        const initialMessage = this.modelConfigurations[ia]?.initialMessage || '';
        const filteredInitial = initialMessage.replace(/^SISTEMA:.*$/gm, '');
        const currentDraft = this.emailDrafts.get(user);
        const draftContext = currentDraft
            ? `\n[Fluxo de Email em andamento]:
                Destinatário: ${currentDraft.recipient || 'não informado'}
                Assunto: ${currentDraft.subject || 'não informado'}
                Conteúdo: ${currentDraft.body || 'não informado'}`
            : '';

        const context = `${filteredInitial}${draftContext}\n${filteredHistory.join("\n")}`;

        console.log('Contexto enviado:', context); // Debug

        return context;
    }


    private updateConversationHistory(
        user: string,
        userMessage: string,
        aiResponse: string,
        metadata?: { emailDraft?: EmailDraft }
    ): void {
        if (!this.conversationHistory.has(user)) {
            this.conversationHistory.set(user, []);
        }

        const history = this.conversationHistory.get(user)!;
        history.push(`USER: ${userMessage}`);
        history.push(`AI: ${aiResponse}`);

        if (metadata?.emailDraft) {
            history.push(`METADATA: ${JSON.stringify(metadata.emailDraft)}`);
        }

        console.log(`Histórico atualizado para ${user}:`, history); // Debug

        if (history.length > 50) {
            history.splice(0, history.length - 50);
        }

        this.conversationHistory.set(user, history);
    }

}
