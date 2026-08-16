import { Request, Response } from 'express';
import { ClientRepository } from '../repositories/client.repository';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { CalendarService } from '../services/calendar.service';
import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2';

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
      const { fullName, phone, email, startTime, serviceId, notes } = req.body;

      if (!serviceId) {
        return res.status(400).json({ success: false, message: 'Debe seleccionar un servicio' });
      }

      const [serviceRows] = await pool.query<RowDataPacket[]>(
        'SELECT id, name, duration_minutes, price FROM services WHERE id = ? LIMIT 1',
        [serviceId]
      );

      if (serviceRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Servicio no encontrado' });
      }

      const service = serviceRows[0];
      const start = new Date(startTime);
      const end = new Date(start.getTime() + service.duration_minutes * 60 * 1000);

      if (!CalendarService.isWithinWorkingHours(start)) {
        return res.status(400).json({
          success: false,
          message: 'El horario está fuera del rango de atención de RELAX (Jueves hasta 2pm, otros días hasta 6pm)',
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
        start_time: start,
        end_time: end,
        status: 'CONFIRMED',
        price_paid: service.price,
        google_event_id: googleEventId,
        notes,
      });

      return res.status(201).json({
        success: true,
        message: 'Sesión RELAX creada y sincronizada con éxito',
        appointmentId,
        googleEventId,
        service: service.name,
        duration: `${service.duration_minutes} min`,
        price: `S/ ${service.price}`,
      });
    } catch (error) {
      console.error('Error al agendar sesión RELAX:', error);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
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
