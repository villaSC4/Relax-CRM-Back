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

app.use(cors());
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

const PORT = process.env.PORT || 3001;

app.listen(PORT, async () => {
  await testConnection();
  console.log(`🌿 Servidor CRM RELAX by QMEDIC corriendo en el puerto ${PORT}`);

  try {
    await WhatsAppService.init();
  } catch (err: any) {
    console.error('⚠️ Error al iniciar WhatsAppService:', err.message);
  }
});

