import { Request, Response } from 'express';
import { ClientRepository } from '../repositories/client.repository';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { CalendarService } from '../services/calendar.service';
import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2';

function parseToLimaDate(rawInput: string): Date {
  let clean = rawInput.toString().replace(/hrs|horas/gi, '').trim();
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(clean)) {
    clean = clean.replace(' ', 'T');
    if (clean.length === 16) clean += ':00';
    clean += '-05:00';
  }
  return new Date(clean);
}

function formatToMySQLDateTime(d: Date): string {
  const limaStr = d.toLocaleString('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return limaStr.replace(',', '').trim();
}

export class CRMAppointmentController {
  static async getAllAppointments(req: Request, res: Response) {
    try {
      const appointments = await AppointmentRepository.findAllWithClientDetails();
      return res.status(200).json({ success: true, data: appointments });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: 'Error al obtener sesiones de MySQL' });
    }
  }

  static async createAppointment(req: Request, res: Response) {
    try {
      const body = req.body || {};
      const fullName = body.fullName || body.clientName || body.name || 'Cliente RELAX';
      const phone = (body.phone || body.telephone || body.clientPhone || '').toString().trim();
      const email = body.email || body.clientEmail || null;
      const notes = body.notes || null;
      const serviceId = Number(body.serviceId || body.service_id);

      if (!serviceId) {
        return res.status(400).json({ success: false, message: 'Debe seleccionar un servicio' });
      }

      if (!phone) {
        return res.status(400).json({ success: false, message: 'Debe ingresar un número de teléfono / WhatsApp' });
      }

      const [serviceRows] = await pool.query<RowDataPacket[]>(
        'SELECT id, name, duration_minutes, price FROM services WHERE id = ? LIMIT 1',
        [serviceId]
      );

      if (serviceRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Servicio no encontrado' });
      }

      const service = serviceRows[0];

      // Parsear fecha y hora en zona horaria oficial de Perú (-05:00)
      let start: Date;
      const rawStart = body.startTime || body.start_time;
      const rawDate = body.date || body.sessionDate;
      const rawTime = body.time || body.slot || body.hour;

      if (rawStart) {
        start = parseToLimaDate(rawStart);
      } else if (rawDate && rawTime) {
        const cleanSlot = rawTime.toString().replace(/[^\d:]/g, '').trim();
        start = parseToLimaDate(`${rawDate}T${cleanSlot}:00`);
      } else {
        return res.status(400).json({ success: false, message: 'Debe seleccionar fecha y hora para la sesión' });
      }

      if (isNaN(start.getTime())) {
        return res.status(400).json({ success: false, message: 'Formato de fecha u horario inválido' });
      }

      const end = new Date(start.getTime() + service.duration_minutes * 60 * 1000);

      if (!CalendarService.isWithinWorkingHours(start)) {
        return res.status(400).json({
          success: false,
          message: 'El horario seleccionado está fuera del rango de atención de RELAX (Lunes a Sábado hasta 7pm, Jueves hasta 2pm)',
        });
      }

      let client = await ClientRepository.findByPhone(phone);
      let clientId: number;

      if (!client) {
        clientId = await ClientRepository.create({ full_name: fullName, phone, email });
      } else {
        clientId = client.id!;
      }

      const googleEventId = await CalendarService.createAppointmentEvent({
        clientName: fullName,
        phone,
        serviceName: service.name,
        durationMinutes: service.duration_minutes,
        startTime: start,
        endTime: end,
      });

      const appointmentId = await AppointmentRepository.create({
        client_id: clientId,
        service_id: serviceId,
        start_time: formatToMySQLDateTime(start),
        end_time: formatToMySQLDateTime(end),
        status: 'CONFIRMED',
        price_paid: service.price,
        google_event_id: googleEventId || null,
        notes,
      });

      console.log(`✅ Cita agendada #${appointmentId} para ${fullName} (${service.name}) el ${formatToMySQLDateTime(start)}`);

      return res.status(201).json({
        success: true,
        message: 'Sesión RELAX creada y sincronizada con éxito',
        appointmentId,
        googleEventId,
        service: service.name,
        duration: `${service.duration_minutes} min`,
        price: `S/ ${service.price}`,
      });
    } catch (error: any) {
      console.error('❌ Error al agendar sesión RELAX:', error.message || error);
      return res.status(500).json({ success: false, message: error.message || 'Error interno del servidor al agendar sesión' });
    }
  }

  static async getSlots(req: Request, res: Response) {
    try {
      const { date, serviceId } = req.query;

      if (!date || typeof date !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Debe proporcionar una fecha en formato YYYY-MM-DD en la query.',
        });
      }

      let durationMinutes = 50;

      if (serviceId) {
        try {
          const [serviceRows] = await pool.query<RowDataPacket[]>(
            'SELECT duration_minutes FROM services WHERE id = ? LIMIT 1',
            [serviceId]
          );
          if (serviceRows && serviceRows.length > 0) {
            durationMinutes = serviceRows[0].duration_minutes;
          }
        } catch (dbErr: any) {
          console.warn('⚠️ No se pudo consultar duración del servicio en BD (usando 50 min):', dbErr.message);
        }
      }

      const availableSlots = await CalendarService.getAvailableSlots(date, durationMinutes);

      return res.status(200).json({
        success: true,
        date,
        durationMinutes,
        availableSlots,
      });
    } catch (error) {
      console.error('Error al obtener slots:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al consultar disponibilidad en Google Calendar',
      });
    }
  }

  static async updateStatus(req: Request, res: Response) {
    try {
      const appointmentId = Number(req.params.id);
      const { status } = req.body;

      if (!['CONFIRMED', 'ATTENDED', 'CANCELLED'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Estado inválido' });
      }

      const [appointmentRows]: any = await pool.query(
        'SELECT id FROM appointments WHERE id = ? LIMIT 1',
        [appointmentId]
      );

      if (appointmentRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Sesión no encontrada' });
      }

      await pool.query('UPDATE appointments SET status = ? WHERE id = ?', [status, appointmentId]);

      return res.status(200).json({ success: true, message: 'Estado de sesión actualizado correctamente' });
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      return res.status(500).json({ success: false, message: 'Error al cambiar estado de la sesión' });
    }
  }
}
