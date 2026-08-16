import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection, pool } from './config/database';
import { CRMAppointmentController } from './controllers/crm-appointment.controller';
import { WhatsAppService } from './services/whatsapp.service';
import { CRMChatController } from './controllers/crm-chat.controller';
import { CRMClientController } from './controllers/crm-client.controller';
import authRoutes from './routes/authRoutes';
import { RowDataPacket } from 'mysql2';

dotenv.config();

const app = express();

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  })
);
app.use(express.json());

app.use('/api/auth', authRoutes);

app.get('/api/v1/crm/clients', CRMClientController.getAllClients);
app.put('/api/v1/crm/clients/:id/notes', CRMClientController.updateNotes);

app.get('/api/v1/crm/chats', CRMChatController.getConversations);
app.get('/api/v1/crm/chats/:conversationId/messages', CRMChatController.getMessages);
app.post('/api/v1/crm/chats/send', CRMChatController.sendMessage);

app.get('/api/v1/crm/appointments', CRMAppointmentController.getAllAppointments);
app.get('/api/v1/crm/appointments/slots', CRMAppointmentController.getSlots);
app.post('/api/v1/crm/appointments', CRMAppointmentController.createAppointment);
app.patch('/api/v1/crm/appointments/:id/status', CRMAppointmentController.updateStatus);

app.get('/api/v1/crm/services', async (req, res) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, name, duration_minutes, price FROM services ORDER BY name, duration_minutes'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener servicios' });
  }
});

// Health check y estado del servidor
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    name: 'RELAX by QMEDIC CRM API',
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, '0.0.0.0', async () => {
  await testConnection();
  console.log(`🌿 Servidor CRM RELAX by QMEDIC corriendo en 0.0.0.0:${PORT}`);

  try {
    await WhatsAppService.init();
  } catch (err: any) {
    console.error('⚠️ Error al iniciar WhatsAppService:', err.message);
  }
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception capturada (evitando caída del servidor):', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection capturada en:', promise, 'motivo:', reason);
});

