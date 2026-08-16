import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { ClientRepository } from '../repositories/client.repository';
import { ChatRepository } from '../repositories/chat.repository';

export class WhatsAppService {
  private static client: Client;

  static async init() {
    if (process.env.ENABLE_WHATSAPP === 'false') {
      console.log('ℹ️ WhatsAppService desactivado por variable ENABLE_WHATSAPP=false');
      return;
    }

    try {
      this.client = new Client({
        authStrategy: new LocalAuth({ dataPath: process.env.WWEBJS_AUTH_PATH || './auth_info_wwebjs' }),
        puppeteer: {
          headless: true,
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-software-rasterizer',
            '--disable-background-networking',
            '--disable-default-apps',
            '--disable-sync',
            '--disable-translate',
            '--hide-scrollbars',
            '--metrics-recording-only',
            '--mute-audio',
            '--safebrowsing-disable-auto-update',
            '--js-flags=--max-old-space-size=128',
          ],
        },
      });

    this.client.on('qr', (qr) => {
      console.log('\n📲 ESCANEA ESTE CÓDIGO QR CON WHATSAPP RELAX (912 680 658):');
      qrcode.generate(qr, { small: true });
    });

    this.client.on('ready', () => {
      console.log('✅ WhatsApp RELAX conectado y listo para recibir y enviar mensajes.');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('❌ Fallo de autenticación en WhatsApp RELAX:', msg);
    });

    this.client.on('message', async (msg) => {
      if (msg.from.endsWith('@g.us') || msg.from === 'status@broadcast') return;

      const contact = await msg.getContact();

      const rawIdentifier = msg.from;
      const identifier = contact.number ? contact.number.replace(/\D/g, '') : rawIdentifier.split('@')[0];
      const displayName = contact.name || contact.pushname || `Cliente ${identifier}`;
      const body = msg.body;

      if (!body) return;

      console.log(`📩 Mensaje recibido de ${displayName} (${identifier}): ${body}`);

      try {
        let client = await ClientRepository.findByPhone(identifier);
        let clientId: number;

        if (!client) {
          clientId = await ClientRepository.create({
            full_name: displayName,
            phone: identifier,
          });
        } else {
          clientId = client.id!;
        }

        const conversationId = await ChatRepository.getOrCreateConversation(clientId);
        await ChatRepository.saveMessage({
          conversationId,
          sender: 'CLIENT',
          body,
        });
      } catch (error) {
        console.error('Error al guardar mensaje en MySQL:', error);
      }
    });

      this.client.initialize().catch((err) => {
        console.error('⚠️ Error al iniciar cliente de WhatsApp Web:', err.message);
      });
    } catch (err: any) {
      console.error('⚠️ Error en la configuración de WhatsAppService:', err.message);
    }
  }

  static async sendMessage(target: string, text: string) {
    if (!this.client) {
      throw new Error('El cliente de WhatsApp no está inicializado');
    }

    let finalChatId = target.trim();

    if (!finalChatId.includes('@')) {
      if (finalChatId.length > 13 && !finalChatId.startsWith('51')) {
        finalChatId = `${finalChatId}@lid`;
      } else {
        const clean = finalChatId.replace(/\D/g, '');
        const formatted = clean.length === 9 && clean.startsWith('9') ? `51${clean}` : clean;
        finalChatId = `${formatted}@c.us`;
      }
    }

    console.log(`📤 Enviando mensaje a ${finalChatId}: ${text}`);

    try {
      const chat = await this.client.getChatById(finalChatId);
      return await chat.sendMessage(text);
    } catch (err) {
      return await this.client.sendMessage(finalChatId, text);
    }
  }
}
