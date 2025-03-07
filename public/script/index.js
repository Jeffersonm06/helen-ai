const sendButton = document.getElementById('send-btn');
const userInput = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');

// Função para adicionar mensagem (mantida igual)
function addMessage(content, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');

    // Expressão regular para encontrar texto entre *** e **
    const boldtext = content.replace(/\*\s\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    const breakLineTotilte = boldtext.replace(/\*\*(.*?)\*\*/g, '<br><h3>$1</h3>');
    const breakLine = breakLineTotilte.replace(/\*\s(.*?)/g, '<br>$1');
    messageDiv.innerHTML = breakLine;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}


// Chamada API corrigida
async function getChatbotResponse(userMessage) {
    try {
        const response = await fetch(`http://localhost:3000/ai/chat?message=${encodeURIComponent(userMessage)}`);

        // Força o parsing como JSON mesmo em erros HTTP
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Erro desconhecido');
        }
        console.log(data.response)

        return data.response;

    } catch (error) {
        console.error('Erro:', error);
        return error.message || 'Serviço temporariamente indisponível';
    }
}

// Evento de envio de mensagem (mantido igual)
sendButton.addEventListener('click', async () => {
    const message = userInput.value.trim();
    if (message) {
        addMessage(message, 'user');
        userInput.value = '';
        try {
            const botResponse = await getChatbotResponse(message);

            // Se a resposta contém conteúdo entre "```"
            if (botResponse.includes("```")) {
                // Expressão regular para capturar o que está entre as três crases
                const regex = /```html([\s\S]*?)```/;
                const match = botResponse.match(regex);
                if (match && match[1]) {
                    const pdfHtml = match[1].trim();
                    addMessage('Aqui', 'bot');

                    // Cria dinamicamente o botão de download
                    const downloadButton = document.createElement('button');
                    downloadButton.innerText = "Baixar PDF";
                    downloadButton.addEventListener('click', async () => {
                        try {
                            const response = await fetch('http://localhost:3000/pdf/generate', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                // Envia o conteúdo do PDF em um objeto JSON
                                body: JSON.stringify({ htmlContent: pdfHtml })
                            });

                            if (!response.ok) {
                                throw new Error('Erro ao gerar o PDF');
                            }

                            // Converte a resposta para Blob (arquivo binário)
                            const pdfBlob = await response.blob();
                            const pdfUrl = URL.createObjectURL(pdfBlob);

                            // Cria um link para forçar o download
                            const a = document.createElement('a');
                            a.href = pdfUrl;
                            a.download = 'documento.pdf';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);

                            // Libera a URL do objeto
                            URL.revokeObjectURL(pdfUrl);
                        } catch (error) {
                            console.error('Erro ao baixar o PDF:', error);
                        }
                    });

                    // Adiciona o botão ao chat ou a área apropriada
                    chatBox.appendChild(downloadButton);
                }
            } else addMessage(botResponse, 'bot');
        } catch (error) {
            addMessage(error.message, 'bot');
        }
    }
});

// Evento de tecla Enter (mantido igual)
userInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') sendButton.click();
});

document.getElementById('download-pdf-btn').addEventListener('click', async () => {
    try {
        const response = await fetch('http://localhost:3000/pdf/generate');

        if (!response.ok) {
            throw new Error('Erro ao gerar o PDF');
        }

        // Converte a resposta para Blob (arquivo binário)
        const pdfBlob = await response.blob();
        const pdfUrl = URL.createObjectURL(pdfBlob);

        // Cria um link para forçar o download
        const a = document.createElement('a');
        a.href = pdfUrl;
        a.download = 'documento.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Libera a URL do objeto
        URL.revokeObjectURL(pdfUrl);
    } catch (error) {
        console.error('Erro ao baixar o PDF:', error);
    }
});
