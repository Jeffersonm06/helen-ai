import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { Response } from 'express';
import * as fs from 'fs';

const browserOptions = {
    args: [
        '--no-sandbox',
        '--disable-gpu'
    ],
    headless: true,
    dumbio: true,
}

@Injectable()
export class PdfService {
    async generatePdf(htmlContent: string, res: Response) {
        let browser;
        try {
            browser = await puppeteer.launch(browserOptions);
            const page = await browser.newPage();

            await page.setContent(htmlContent, { waitUntil: ['domcontentloaded', 'load', 'networkidle0'] });

            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
            });

            if (pdfBuffer.length === 0) throw new Error('PDF gerado está vazio');

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="documento.pdf"');
            res.setHeader('Content-Length', pdfBuffer.length.toString());

            res.end(pdfBuffer);
        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            res.status(500).send('Erro interno ao gerar PDF');
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }
}
