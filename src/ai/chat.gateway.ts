// src/ai/ai.gateway.ts
import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AiService } from 'src/ai/ai.service';

@WebSocketGateway(3100, {
    cors: {
        origin: '*',
    },
})
export class ChatGateway {
    @WebSocketServer()
    server: Server;

    constructor(private readonly aiService: AiService) { }

    handleConnection(client: Socket) {
        console.log(`Client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        console.log(`Client disconnected: ${client.id}`);
    }


    @SubscribeMessage('message')
    async handleMessage(
        @MessageBody() data: { user: string; message: string, model: 'helena' | 'rodrigo' },
        @ConnectedSocket() client: Socket,
    ) {
        const { user, message, model } = data;

        const response = await this.aiService.getGeminiResponse(user, message, model);

        client.emit('message', { model: model, message: response });
    }
}